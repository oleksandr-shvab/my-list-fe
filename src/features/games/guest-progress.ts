import { toast } from 'sonner'
import type { GameGuesserView } from '@/api/generated/models'
import i18n from '@/i18n'
import { ApiError } from '@/lib/api-client'
import {
  DEFAULT_VARIANT,
  deleteGuestRecord,
  readGuestRecord,
  writeGuestRecord,
  type GuestRecord,
} from './guest-records'

function keyOf(slug: string, date: string) {
  return { slug, variant: DEFAULT_VARIANT, date }
}

// The record of a puzzle as the browser holds it. A caller reads it once per action and passes it down.
export function readRecord(slug: string, date: string) {
  return readGuestRecord(keyOf(slug, date))
}

// The record's guesses in order, for `previous` or a resume; nothing when there is no record or it has no guess.
export function guessIdsOf(
  record: GuestRecord | undefined,
): (number | null)[] | undefined {
  if (!record || record.guesses.length === 0) return undefined
  return record.guesses.map((guess) => guess.title_id)
}

// What a guess sends as `previous`: for a guest the record, so another tab's guess is in it (AC-38), else the shown
// guesses. An account sends the shown ones too, in case its session has ended (AC-51).
export function previousOf(
  view: GameGuesserView,
  record: GuestRecord | undefined,
): (number | null)[] {
  if (view.signed_in) return view.guesses.map((guess) => guess.title_id)
  return guessIdsOf(record) ?? view.guesses.map((guess) => guess.title_id)
}

// Does the record hold a game the screen does not show (another tab played)?
export function differsFromShown(
  record: GuestRecord | undefined,
  view: GameGuesserView,
): boolean {
  const stored = guessIdsOf(record)
  if (!record || !stored) return false
  return (
    record.status !== view.status ||
    stored.length !== view.guesses.length ||
    stored.some((id, index) => id !== view.guesses[index].title_id)
  )
}

type Known = Pick<GameGuesserView, 'counts_for_streak' | 'daily_proof'>

// Keeps a guest's `counts_for_streak` and `daily_proof` from going null (resume, later guesses and off-day views send
// null): the first non-null of the answer and `known` wins (AC-40, AC-41). An account's answer is the server's.
export function withKnownValues(
  answer: GameGuesserView,
  ...known: (Known | undefined)[]
): GameGuesserView {
  if (answer.signed_in) return answer
  const sources = [answer, ...known]
  return {
    ...answer,
    counts_for_streak:
      sources.find((source) => source?.counts_for_streak != null)
        ?.counts_for_streak ?? null,
    daily_proof:
      sources.find((source) => source?.daily_proof != null)?.daily_proof ??
      null,
  }
}

// Stores a guest's answer, never one with `signed_in: true` (AC-50): after a guess the whole guess list is the record
// (R-4), any other answer only keeps its `daily_proof` (AC-40). `existing` is the record the caller read (`null` for
// none; left out, it is read here).
export function recordGuestAnswer(
  answer: GameGuesserView,
  afterGuess: boolean,
  existing: GuestRecord | null | undefined = readRecord(
    answer.slug,
    answer.date,
  ),
): GuestRecord | undefined {
  if (answer.signed_in) return existing ?? undefined
  const key = keyOf(answer.slug, answer.date)
  // A later null never erases a kept value (AC-40, AC-41). `counts_for_streak` is the first guess's.
  const dailyProof = answer.daily_proof ?? existing?.daily_proof ?? null

  if (afterGuess) {
    const record: GuestRecord = {
      guesses: answer.guesses.map(({ title_id, name, result }) => ({
        title_id,
        name,
        result,
      })),
      status: answer.status,
      counts_for_streak:
        existing?.counts_for_streak ?? answer.counts_for_streak,
      daily_proof: dailyProof,
    }
    writeGuestRecord(key, record)
    return record
  } else if (
    answer.daily_proof !== null &&
    answer.daily_proof !== existing?.daily_proof
  ) {
    const base: GuestRecord = existing ?? {
      guesses: [],
      status: 'in_progress',
      counts_for_streak: null,
      daily_proof: null,
    }
    const record = { ...base, daily_proof: answer.daily_proof }
    writeGuestRecord(key, record)
    return record
  }
  return existing ?? undefined
}

// The server called the stored history invalid (AC-42): the record goes. `notify` is false when the status line says so.
export function dropDamagedRecord(
  { slug, date }: { slug: string; date: string },
  notify: boolean,
) {
  deleteGuestRecord(keyOf(slug, date))
  if (notify) toast.info(i18n.t('games.progress_damaged'))
}

// Two records hold the same guesses, in order; no record is no guesses.
export function sameGuesses(
  a: GuestRecord | undefined,
  b: GuestRecord | undefined,
): boolean {
  const left = guessIdsOf(a) ?? []
  const right = guessIdsOf(b) ?? []
  return left.length === right.length && left.every((id, i) => id === right[i])
}

export function isInvalidHistory(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'invalid_guess_history'
}
