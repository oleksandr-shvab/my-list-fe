import type { StatsFigures } from './stats-figures'

// The server's stats rules in the browser, for a guest (AC-74). A port of `compute_stats` and `streaks` in the backend's
// `app/games/stats.py`; the rows S1 to S19 and T1 to T4 of SPEC-02 hold both to the same numbers (AC-75).

// A gap of up to this many missed days keeps the run; a longer one starts a new run.
const MAX_MISSED_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

export type GuestPlay = {
  variant: string
  // The puzzle's UTC day, YYYY-MM-DD: the streak day.
  date: string
  status: string
  // Skips count as guesses.
  guessesUsed: number
  countsForStreak: boolean
}

type ComputeInput = {
  plays: readonly GuestPlay[]
  // The server's today, or the device's UTC day when the clock call failed (AC-76).
  today: string
  maxGuesses: number
  // Only plays of this variant count; the streak is the default variant's.
  variant: string
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS
}

// A gap of 1 to 3 missed days keeps the run, 4 or more starts a new one. The current streak is 0 once more than 3 days
// were missed after the last streak day; today is not missed until it is over.
function streaks(
  streakDays: ReadonlySet<string>,
  today: string,
): { current: number; max: number } {
  const days = [...streakDays].map(dayNumber).sort((a, b) => a - b)
  let run = 0
  let max = 0
  let last: number | null = null
  for (const day of days) {
    run = last !== null && day - last - 1 <= MAX_MISSED_DAYS ? run + 1 : 1
    max = Math.max(max, run)
    last = day
  }
  if (last === null) return { current: 0, max: 0 }
  const missedSinceLast = Math.max(dayNumber(today) - last - 1, 0)
  return { current: missedSinceLast <= MAX_MISSED_DAYS ? run : 0, max }
}

export function computeGuestStats({
  plays,
  today,
  maxGuesses,
  variant,
}: ComputeInput): StatsFigures {
  const finished = plays.filter(
    (play) =>
      play.variant === variant &&
      (play.status === 'won' || play.status === 'lost'),
  )
  const distribution: Record<string, number> = {}
  for (let guesses = 1; guesses <= maxGuesses; guesses += 1) {
    distribution[guesses] = 0
  }
  let wins = 0
  for (const play of finished) {
    if (play.status !== 'won') continue
    wins += 1
    // A win with a count outside 1 to `maxGuesses` is bad stored data: it counts everywhere but here (T4).
    if (play.guessesUsed in distribution) distribution[play.guessesUsed] += 1
  }

  const { current, max } = streaks(
    new Set(
      finished.filter((play) => play.countsForStreak).map((play) => play.date),
    ),
    today,
  )
  return {
    played: finished.length,
    wins,
    currentStreak: current,
    maxStreak: max,
    distribution,
  }
}
