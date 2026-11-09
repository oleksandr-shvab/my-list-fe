// "Today" and puzzle dates are UTC days written as YYYY-MM-DD, never the device's local day.

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

// Only the shape and "a real day" are checked here. Whether a puzzle exists for the day is the backend's answer (404).
export function parsePuzzleDate(value: string): string | null {
  if (!PUZZLE_DATE_FORMAT.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  // 2026-02-30 rolls over to March; a day that survives the round trip is a real one.
  const roundTrip = new Date(Date.UTC(year, month - 1, day))
  const isRealDay =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day

  return isRealDay ? value : null
}

export function formatPuzzleDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}
