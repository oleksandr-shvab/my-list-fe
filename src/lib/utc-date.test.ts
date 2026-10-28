import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatPuzzleDate, parsePuzzleDate, todayUtc } from './utc-date'

const originalTimeZone = process.env.TZ

afterEach(() => {
  vi.useRealTimers()
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

// Runs `todayUtc()` with the device clock at `instant`, on a device in `timeZone`.
function todayOnDevice(instant: string, timeZone: string) {
  process.env.TZ = timeZone
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
    expect(parsePuzzleDate('2024-02-29', today)).toEqual({
      date: '2024-02-29',
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
    process.env.TZ = 'Etc/GMT+5'
    expect(formatPuzzleDate('2026-10-28', 'en')).toBe('October 28, 2026')
    process.env.TZ = 'Pacific/Kiritimati'
    expect(formatPuzzleDate('2026-10-28', 'en')).toBe('October 28, 2026')
  })
})
