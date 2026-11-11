import { queryOptions, useQuery, type QueryStatus } from '@tanstack/react-query'
import { toast } from 'sonner'
import { gamesListGames, gamesMergeProgress } from '@/api/generated/api'
import type { MergeEntry } from '@/api/generated/models'
import { useSession, type SessionStatus } from '@/features/auth/session'
import i18n from '@/i18n'
import { ApiError } from '@/lib/api-client'
import { sleep } from '@/lib/sleep'
import { sameGuesses } from './guest-progress'
import {
  deleteGuestRecord,
  readGuestRecord,
  readGuestRecordsByGame,
  type GuestRecord,
  type GuestRecordKey,
} from './guest-records'
import { slugsOf } from './queries'
import { GAMES } from './registry'

// The server takes at most 500 entries per request (SPEC-02 AC-62).
const MERGE_CHUNK_SIZE = 500

// The server refuses a whole request for a variant over 32 characters or a proof over 100 (CONTRACTS, "Guest merge").
// Such a record is not sent and stays; such a proof is sent as null, and its game merges as an archive play.
const MAX_VARIANT_LENGTH = 32
const MAX_DAILY_PROOF_LENGTH = 100

// A request with no answer in time fails, so the account's game never waits on it; a 503 or a lost connection is sent
// again after these waits (a merge is idempotent, SPEC-02 AC-61). Tests shorten them.
export const MERGE_TIMING = {
  requestTimeoutMs: 10_000,
  retryDelaysMs: [300, 900],
}

class MergeTimeout extends Error {}

type Sent = { key: GuestRecordKey; record: GuestRecord }

function entryOf({ key, record }: Sent): MergeEntry {
  return {
    date: key.date,
    variant: key.variant,
    guesses: record.guesses.map((guess) => guess.title_id),
    played_as_daily: record.counts_for_streak === true,
    daily_proof:
      record.daily_proof !== null &&
      record.daily_proof.length <= MAX_DAILY_PROOF_LENGTH
        ? record.daily_proof
        : null,
  }
}

// Runs `work` with a signal that also aborts when the time is up, which then fails with `MergeTimeout`.
async function withDeadline<T>(
  signal: AbortSignal,
  work: (deadline: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = setTimeout(abort, MERGE_TIMING.requestTimeoutMs)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  try {
    return await work(controller.signal)
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) throw new MergeTimeout()
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

function canSendAgain(error: unknown, signal: AbortSignal): boolean {
  // An aborted request fails like a lost connection (`status` 0): that one is the session ending.
  return (
    !signal.aborted &&
    error instanceof ApiError &&
    (error.isNetworkError || error.status === 503)
  )
}

async function sendChunk(
  slug: string,
  entries: MergeEntry[],
  signal: AbortSignal,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await withDeadline(signal, (deadline) =>
        gamesMergeProgress(slug, { entries }, { signal: deadline }),
      )
    } catch (error) {
      const delay = MERGE_TIMING.retryDelaysMs[attempt]
      if (delay === undefined || !canSendAgain(error, signal)) throw error
      await sleep(delay, signal)
    }
  }
}

// A record goes only if it still holds the guesses that were sent: another tab may have played on. A record with no
// guess is never sent, so never deleted; a sent day's proof goes with its record.
function deleteSent(sent: Sent[]) {
  for (const { key, record } of sent) {
    if (sameGuesses(readGuestRecord(key), record)) deleteGuestRecord(key)
  }
}

// Moves this browser's played games into the account (AC-95 to AC-99). Nothing is deleted until every request of every
// game has answered 200 (AC-97); any failure keeps every record.
async function mergeGuestGames(signal: AbortSignal) {
  const played = [...readGuestRecordsByGame(GAMES.map((game) => game.slug))]
    .map(([slug, records]) => ({
      slug,
      records: records.filter(
        ({ key }) => key.variant.length <= MAX_VARIANT_LENGTH,
      ),
    }))
    .filter(({ records }) => records.length > 0)
  if (played.length === 0) return { stored: 0 }

  const sent: Sent[] = []
  let stored = 0

  try {
    // Only the server's own list says which games take a merge: a game it lacks would refuse the whole request.
    const listed = slugsOf(
      await withDeadline(signal, (deadline) =>
        gamesListGames({ signal: deadline }),
      ),
    )
    for (const { slug, records } of played) {
      if (!listed.has(slug)) continue
      for (let from = 0; from < records.length; from += MERGE_CHUNK_SIZE) {
        const chunk = records.slice(from, from + MERGE_CHUNK_SIZE)
        const answer = await sendChunk(slug, chunk.map(entryOf), signal)
        stored += answer.stored
        sent.push(...chunk)
      }
    }
  } catch (error) {
    // A 401 or a session that ended meanwhile (which aborts the signal) is not a failed merge (AC-99).
    const sessionEnded = error instanceof ApiError && error.status === 401
    if (!sessionEnded && !signal.aborted) {
      toast.error(i18n.t('games.merge_failed'))
    }
    throw error
  }

  deleteSent(sent)
  if (stored > 0) toast.success(i18n.t('games.merge_done', { count: stored }))
  return { stored }
}

// Runs once per signed-in user, on a login, sign-up or page load (AC-98). A failure is not tried again until the next
// load: the options below stop a refocus, a reconnect and a remounted layout, and `gcTime` keeps the failed query.
export function guestMergeQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: ['guest-merge', userId ?? null] as const,
    queryFn: ({ signal }) => mergeGuestGames(signal),
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Offline it fails (a network error) instead of pausing, so the account's game is never held for it.
    networkMode: 'always',
    staleTime: Infinity,
    // Without it the failed query is collected after 5 minutes outside the `_app` layout and would run again.
    gcTime: Infinity,
    // A 401 is the session ending (AC-99), not a fault to report.
    meta: { expectedStatuses: [401] },
  })
}

// Only the `_app` layout calls this: it starts the merge, so it runs on any page.
export function useGuestMerge() {
  const session = useSession()
  useQuery({
    ...guestMergeQueryOptions(session.user?.id),
    enabled: session.status === 'signed_in',
  })
}

// False only while a signed-in user's merge has not answered (AC-100); a failed one is settled.
export function isMergeSettled(
  session: SessionStatus,
  merge: QueryStatus,
): boolean {
  return session !== 'signed_in' || merge !== 'pending'
}

// For a screen that waits for the merge: it reads the layout's query and never starts it.
export function useMergeSettled(session: ReturnType<typeof useSession>) {
  const merge = useQuery({
    ...guestMergeQueryOptions(session.user?.id),
    enabled: false,
  })
  return isMergeSettled(session.status, merge.status)
}
