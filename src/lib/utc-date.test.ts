import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FIRST_PUZZLE_DATE,
  formatPuzzleDate,
  parsePuzzleDate,
  todayUtc,
} from './utc-date'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// Runs `todayUtc()` with the device clock at `instant`, on a device in `timeZone`.
function todayOnDevice(instant: string, timeZone: string) {
  vi.stubEnv('TZ', timeZone)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(instant))
  return { today: todayUtc(), localHour: new Date().getHours() }
}

describe('todayUtc (AC-46)', () => {
  it('is the UTC day for a device at 23:30 in UTC-5', () => {
    // 23:30 on the 27th on the device, 04:30 on the 28th in UTC.
    const { today, localHour } = todayOnDevice(
      '2026-10-28T04:30:00Z',
      'Etc/GMT+5',
    )

    expect(localHour).toBe(23)
    expect(today).toBe('2026-10-28')
  })

  it('is the UTC day for a device at 01:00 in UTC+3', () => {
    // 01:00 on the 28th on the device, 22:00 on the 27th in UTC.
    const { today, localHour } = todayOnDevice(
      '2026-10-27T22:00:00Z',
      'Europe/Moscow',
    )

    expect(localHour).toBe(1)
    expect(today).toBe('2026-10-27')
  })

  it('takes a given moment, and pads short years and one-digit months', () => {
    expect(todayUtc(new Date('2026-01-05T23:59:59Z'))).toBe('2026-01-05')
    expect(todayUtc(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31')
  })
})

describe('parsePuzzleDate (AC-44, AC-45)', () => {
  const today = '2026-10-28'

  it('accepts a real day up to today, and flags today', () => {
    expect(parsePuzzleDate('2026-10-01', today)).toEqual({
      date: '2026-10-01',
      isToday: false,
    })
    expect(parsePuzzleDate('2026-10-28', today)).toEqual({
      date: '2026-10-28',
      isToday: true,
    })
    expect(parsePuzzleDate('2028-02-29', '2028-03-01')).toEqual({
      date: '2028-02-29',
      isToday: false,
    })
  })

  it('accepts the first puzzle day when today is later', () => {
    expect(FIRST_PUZZLE_DATE).toBe('2026-01-01')
    expect(parsePuzzleDate('2026-01-01', today)).toEqual({
      date: '2026-01-01',
      isToday: false,
    })
  })

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['a leap day in a year without one', '2026-02-29'],
    ['month 13', '2026-13-01'],
    ['day 00', '2026-10-00'],
    ['a short month and day', '2026-1-5'],
    ['a word', 'today'],
    ['a leading space', ' 2026-10-01'],
    ['trailing text', '2026-10-01x'],
    ['a line break at the end', '2026-10-01\n'],
    ['an empty value', ''],
    ['tomorrow', '2026-10-29'],
    ['a far future day', '2099-01-01'],
    // `Date.UTC` maps the years 0 to 99 to 1900 to 1999, so the round trip alone lets some pass.
    ['year 0000', '0000-01-01'],
    ['year 0050', '0050-06-01'],
    ['year 0100', '0100-01-01'],
    ['the day before the first puzzle', '2025-12-31'],
  ])('rejects %s', (_case, value) => {
    expect(parsePuzzleDate(value, today)).toBeNull()
  })
})

describe('formatPuzzleDate', () => {
  it('writes the UTC day in the current language', () => {
    expect(formatPuzzleDate('2026-10-28', 'en')).toBe('October 28, 2026')
    expect(formatPuzzleDate('2026-10-28', 'ru')).toBe('28 октября 2026 г.')
  })

  it('does not move the day with the device time zone', () => {
    vi.stubEnv('TZ', 'Etc/GMT+5')
    expect(formatPuzzleDate('2026-10-28', 'en')).toBe('October 28, 2026')
    vi.stubEnv('TZ', 'Pacific/Kiritimati')
    expect(formatPuzzleDate('2026-10-28', 'en')).toBe('October 28, 2026')
  })
})
