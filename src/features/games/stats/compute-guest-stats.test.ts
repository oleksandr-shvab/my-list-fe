import { describe, expect, it } from 'vitest'
import { computeGuestStats, type GuestPlay } from './compute-guest-stats'

// The rows are the backend's, with the same ids: `my-list-be/tests/test_stats_rules.py` (STREAK_ROWS and COUNTER_ROWS),
// SPEC-02 AC-52 and AC-54 (AC-75). The spec's UTC day number 1 is 2026-10-01.
const MAX_GUESSES = 6
const DEFAULT = 'default'
const WON = 'won'
const LOST = 'lost'
const IN_PROGRESS = 'in_progress'

function day(number: number): string {
  return new Date(Date.UTC(2026, 9, number)).toISOString().slice(0, 10)
}

function play(
  number: number,
  status: string = WON,
  options: { guesses?: number; countsForStreak?: boolean } = {},
): GuestPlay {
  return {
    variant: DEFAULT,
    date: day(number),
    status,
    guessesUsed: options.guesses ?? 3,
    countsForStreak: options.countsForStreak ?? true,
  }
}

// Finished daily plays: the spec's "daily finishes" column.
function daily(...numbers: number[]): GuestPlay[] {
  return numbers.map((number) => play(number))
}

function statsOf(plays: GuestPlay[], today: number) {
  return computeGuestStats({
    plays,
    today: day(today),
    maxGuesses: MAX_GUESSES,
    variant: DEFAULT,
  })
}

// id, plays, today, current, max.
const STREAK_ROWS: [string, GuestPlay[], number, number, number][] = [
  ['S1', [], 1, 0, 0],
  ['S2', daily(1), 1, 1, 1],
  ['S3', daily(1), 2, 1, 1],
  ['S4', daily(1, 2, 3), 3, 3, 3],
  ['S5', daily(1, 5), 5, 2, 2],
  ['S6', daily(1, 6), 6, 1, 1],
  ['S7', daily(1), 5, 1, 1],
  ['S8', daily(1), 6, 0, 1],
  ['S9', daily(1, 2, 4, 5), 5, 4, 4],
  ['S10', daily(1, 3, 5, 7), 7, 4, 4],
  ['S11', daily(1, 2, 3, 8, 9), 9, 2, 3],
  ['S12', daily(1, 2, 3, 4, 5, 10), 12, 1, 5],
  ['S13', daily(1, 2, 3), 7, 3, 3],
  ['S14', daily(1, 2, 3), 8, 0, 3],
  // An archive finish of day 2, played on day 3: the flag is false, so it fills no day.
  ['S15', [...daily(1, 3), play(2, WON, { countsForStreak: false })], 3, 2, 2],
  // Day 2 was started as a daily and never finished: not activity.
  ['S16', [...daily(1, 3), play(2, IN_PROGRESS, { guesses: 2 })], 3, 2, 2],
  // Losing counts.
  [
    'S17',
    [play(1, LOST, { guesses: 6 }), play(2), play(3, LOST, { guesses: 6 })],
    3,
    3,
    3,
  ],
  // Day 2 began on day 3 (the stored flag is false), then finished: archive.
  ['S18', [play(1), play(2, WON, { countsForStreak: false })], 3, 1, 1],
  // Day 2 began at 23:59 on day 2 and finished on day 3: the stored flag is true, and the streak day is the puzzle's
  // date, not the finish date.
  ['S19', daily(1, 2), 3, 2, 2],
  // Not a spec row: the same day twice is one streak day, not a run of 2.
  ['same_day_twice', daily(1, 1), 1, 1, 1],
]

// id, plays, played, wins, the wins by guesses that are not zero.
const COUNTER_ROWS: [
  string,
  GuestPlay[],
  number,
  number,
  Record<number, number>,
][] = [
  [
    'T1',
    [
      play(1, WON, { guesses: 1 }),
      play(2, WON, { guesses: 3 }),
      play(3, LOST, { guesses: 6 }),
      play(4, WON, { guesses: 6, countsForStreak: false }),
      play(5, IN_PROGRESS, { guesses: 2 }),
    ],
    4,
    3,
    { 1: 1, 3: 1, 6: 1 },
  ],
  [
    'T2',
    [
      play(1, LOST, { guesses: 6, countsForStreak: false }),
      play(2, LOST, { guesses: 6, countsForStreak: false }),
    ],
    2,
    0,
    {},
  ],
  ['T3', [], 0, 0, {}],
  // Day 2 is a bad stored row (7 guesses): a win with no bucket.
  [
    'T4',
    [play(1, WON, { guesses: 2 }), play(2, WON, { guesses: 7 })],
    2,
    2,
    { 2: 1 },
  ],
]

describe('computeGuestStats', () => {
  it.each(STREAK_ROWS)(
    '%s: the streak matches the shared table',
    (_id, plays, today, current, max) => {
      const stats = statsOf(plays, today)

      expect([stats.currentStreak, stats.maxStreak]).toEqual([current, max])
    },
  )

  it.each(COUNTER_ROWS)(
    '%s: the counters match the shared table',
    (_id, plays, played, wins, winsByGuesses) => {
      const stats = statsOf(plays, 10)

      expect([stats.played, stats.wins]).toEqual([played, wins])
      // Keys 1 to 6 are always there, zeros included.
      expect(stats.distribution).toEqual(
        Object.fromEntries(
          Array.from({ length: MAX_GUESSES }, (_, i) => [
            i + 1,
            winsByGuesses[i + 1] ?? 0,
          ]),
        ),
      )
    },
  )

  // The shared table only has days of one month. These are the backend's CALENDAR_ROWS: real dates across a year end and
  // the end of February in a year that is not a leap year, with `today` the last day.
  it.each([
    ['year_end_continued', ['2026-12-31', '2027-01-01'], 2, 2],
    ['year_end_three_missed_continued', ['2026-12-30', '2027-01-03'], 2, 2],
    [
      'year_end_four_missed_reset',
      ['2026-12-26', '2026-12-27', '2027-01-01'],
      1,
      2,
    ],
    ['february_end_continued', ['2027-02-28', '2027-03-01'], 2, 2],
    ['february_end_three_missed_continued', ['2027-02-25', '2027-03-01'], 2, 2],
    [
      'february_end_four_missed_reset',
      ['2027-02-23', '2027-02-24', '2027-03-01'],
      1,
      2,
    ],
  ])(
    '%s: the streak runs across a month or year end',
    (_id, dates, current, max) => {
      const stats = computeGuestStats({
        // Newest first: the order of the plays does not matter.
        plays: dates.map((date) => ({ ...play(1), date })).reverse(),
        today: dates[dates.length - 1],
        maxGuesses: MAX_GUESSES,
        variant: DEFAULT,
      })

      expect([stats.currentStreak, stats.maxStreak]).toEqual([current, max])
    },
  )

  it('counts nothing of another variant, and a win with no valid guess count is a played win and a streak day with no bar', () => {
    const plays = [
      play(1, WON, { guesses: 2 }),
      // A win with 0 guesses is bad stored data (the backend has the same row): played, won, day 2 of the run.
      play(2, WON, { guesses: 0 }),
      play(3, LOST, { guesses: 6 }),
      { ...play(4, WON), variant: 'hard' },
    ]

    const stats = statsOf(plays, 3)

    expect([stats.played, stats.wins]).toEqual([3, 2])
    expect([stats.currentStreak, stats.maxStreak]).toEqual([3, 3])
    expect(stats.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0 })
  })
})
