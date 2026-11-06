// "Today" and puzzle dates are UTC days written as YYYY-MM-DD, never the device's local day.

// Temporary lower bound until the backend lists past days (M1-16).
export const FIRST_PUZZLE_DATE = '2026-01-01'

const PUZZLE_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/

function pad(value: number, length: number) {
  return String(value).padStart(length, '0')
}

export function todayUtc(now: Date = new Date()): string {
  const year = pad(now.getUTCFullYear(), 4)
  const month = pad(now.getUTCMonth() + 1, 2)
  const day = pad(now.getUTCDate(), 2)
  return `${year}-${month}-${day}`
}

export type PuzzleDate = {
  date: string
  isToday: boolean
}

export function parsePuzzleDate(
  value: string,
  today: string,
): PuzzleDate | null {
  if (!PUZZLE_DATE_FORMAT.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  // 2026-02-30 rolls over to March; a day that survives the round trip is a real one.
  const roundTrip = new Date(Date.UTC(year, month - 1, day))
  const isRealDay =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  // Both are YYYY-MM-DD, so comparing the text compares the days.
  if (!isRealDay || value < FIRST_PUZZLE_DATE || value > today) return null

  return { date: value, isToday: value === today }
}

export function formatPuzzleDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}
