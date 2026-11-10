import { queryOptions, type QueryClient } from '@tanstack/react-query'
import {
  gamesGetPuzzle,
  gamesGetTodayPuzzle,
  gamesResumePuzzle,
} from '@/api/generated/api'
import type { GameGuesserView } from '@/api/generated/models'
import { refreshSession } from '@/features/auth/session'
import {
  dropDamagedRecord,
  guessIdsOf,
  isInvalidHistory,
  readRecord,
  recordGuestAnswer,
  sameGuesses,
  withKnownValues,
} from './guest-progress'
import type { GuestRecord } from './guest-records'

// Whose game the page shows: a user id, `'guest'`, or `'unconfirmed'` when the session check failed. Trust a view's own
// `signed_in`, not its key: `'guest'` can briefly hold an account's view after a login in another tab.
export type Viewer = string

export const GUEST_VIEWER: Viewer = 'guest'
export const UNCONFIRMED_VIEWER: Viewer = 'unconfirmed'

export function isAccountViewer(viewer: Viewer): boolean {
  return viewer !== GUEST_VIEWER && viewer !== UNCONFIRMED_VIEWER
}

export type GameViewTarget = { slug: string; date: string; viewer: Viewer }

// One key per puzzle day and viewer, whichever address opened it: `/` and `/games/{slug}/{date}` show one view.
export function gameViewKey({ slug, date, viewer }: GameViewTarget) {
  return ['game-view', slug, date, viewer] as const
}

// The viewer whose key holds a view: `signed_in: false` is a guest's, and an account's view is never under `'guest'`
// (null).
export function viewerOfView(
  view: GameGuesserView,
  viewer: Viewer,
): Viewer | null {
  if (!view.signed_in) {
    return viewer === UNCONFIRMED_VIEWER ? viewer : GUEST_VIEWER
  }
  return viewer === GUEST_VIEWER ? null : viewer
}

// Where a view lives (the key `writeAnswer` uses), or null when it has no key on this page. A guest view on a user's
// page lives under `'guest'`: the session guard has already signed the page out, so the screen reads that key next.
export function viewTargetOf(
  target: GameViewTarget,
  view: GameGuesserView,
): GameViewTarget | null {
  const viewer = viewerOfView(view, target.viewer)
  return viewer ? { ...target, viewer } : null
}

// The server knows a user the page does not: treat it as a sign-in and ask who it is.
export function checkSessionOfView(
  view: GameGuesserView,
  viewer: Viewer,
  client: QueryClient,
) {
  if (view.signed_in && !isAccountViewer(viewer)) void refreshSession(client)
}

// An answer goes under the key of the view it is (`viewTargetOf`), without blanking a known `counts_for_streak` or
// `daily_proof` (AC-40, AC-41); one that names a user the page does not know asks who is signed in.
export function writeAnswer(
  client: QueryClient,
  target: GameViewTarget,
  answer: GameGuesserView,
  record?: GuestRecord,
) {
  const home = viewTargetOf(target, answer)
  if (home) {
    const key = gameViewKey(home)
    client.setQueryData(
      key,
      withKnownValues(
        answer,
        record,
        client.getQueryData<GameGuesserView>(key),
      ),
    )
  }
  checkSessionOfView(answer, target.viewer, client)
}

// Asks for the page's view again and gives what the cache holds afterwards: the new view, or the old one when the
// request failed.
export async function refetchView(
  client: QueryClient,
  target: GameViewTarget,
): Promise<GameGuesserView | undefined> {
  await client.refetchQueries({ queryKey: gameViewKey(target), exact: true })
  return client.getQueryData<GameGuesserView>(gameViewKey(target))
}

// A guest's view: a stored game comes from resume, never from the empty view (AC-39); a history the server calls
// invalid drops the record, says so and shows the fresh puzzle (AC-42). An account's view never touches records (AC-50).
export async function loadView({
  slug,
  date,
  viewer,
  signal,
  cached,
  fallback,
}: GameViewTarget & {
  signal?: AbortSignal
  cached?: GameGuesserView
  // Resumed when there is no stored game: the guesses a screen shows (a clue refresh).
  fallback?: (number | null)[]
}) {
  if (isAccountViewer(viewer)) {
    return gamesGetPuzzle(slug, date, undefined, { signal })
  }

  let record = readRecord(slug, date)
  let answer: GameGuesserView | undefined
  // A 422 for a record another tab has replaced meanwhile is not damage: the newer record is resumed once.
  for (let attempt = 0; attempt < 2 && !answer; attempt += 1) {
    const previous =
      guessIdsOf(record) ?? (attempt === 0 ? fallback : undefined)
    if (!previous) break
    try {
      answer = await gamesResumePuzzle(slug, date, { previous }, undefined, {
        signal,
      })
    } catch (error) {
      if (!isInvalidHistory(error)) throw error
      const latest = readRecord(slug, date)
      if (attempt === 0 && !sameGuesses(latest, record)) {
        record = latest
        continue
      }
      dropDamagedRecord({ slug, date }, true)
      record = undefined
      break
    }
  }
  answer ??= await gamesGetPuzzle(slug, date, undefined, { signal })

  const view = withKnownValues(answer, record, cached)
  recordGuestAnswer(view, false, record ?? null)
  return view
}

// The puzzle of a known day. Every later fetch of a page goes through this, so an open page keeps its day.
export function gameViewQueryOptions(target: GameViewTarget, enabled: boolean) {
  const { viewer } = target
  return queryOptions({
    queryKey: gameViewKey(target),
    queryFn: async ({ signal, client }) => {
      const view = await loadView({
        ...target,
        signal,
        cached: client.getQueryData<GameGuesserView>(gameViewKey(target)),
      })
      checkSessionOfView(view, viewer, client)
      return view
    },
    enabled,
    // The screen refreshes only on purpose: a guess writes its answer in, and a failed account guess asks again.
    staleTime: Infinity,
  })
}

// A page with no date asks what today is, and the screen pins the answer's day (`opening` is one id per screen shown).
// A guest with a stored game for that day gets no view cached: the dated query resumes it (AC-39).
export function todayViewQueryOptions(
  { slug, viewer, opening }: { slug: string; viewer: Viewer; opening: string },
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['game-today', slug, viewer, opening] as const,
    queryFn: async ({ signal, client }) => {
      const first = await gamesGetTodayPuzzle(slug, undefined, { signal })
      checkSessionOfView(first, viewer, client)
      let view = first
      // The answer decides, not the page's viewer: a session that ended meanwhile gives a guest view to an account page.
      if (!first.signed_in) {
        const record = readRecord(slug, first.date)
        if (guessIdsOf(record)) {
          // The proof goes into the record, and the resumed view picks it up (AC-40).
          recordGuestAnswer(first, false, record)
          return first
        }
        view = withKnownValues(first, record)
        recordGuestAnswer(view, false, record ?? null)
      }
      client.setQueryData(
        gameViewKey({
          slug,
          date: view.date,
          viewer: viewerOfView(view, viewer) ?? viewer,
        }),
        view,
      )
      return view
    },
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
