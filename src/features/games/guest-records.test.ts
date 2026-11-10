// @vitest-environment jsdom
import '@/test/dom-setup'
import { describe, expect, it } from 'vitest'
import {
  readGuestRecord,
  readGuestRecords,
  writeGuestRecord,
  type GuestRecord,
} from './guest-records'

const KEY = { slug: 'game-guesser', variant: 'default', date: '2026-11-05' }
const STORAGE_KEY = 'dgc.guest.v1.game-guesser.default.2026-11-05'

const RECORD: GuestRecord = {
  guesses: [
    { title_id: 42, name: 'Doom', result: 'wrong' },
    { title_id: null, name: null, result: 'skipped' },
  ],
  status: 'in_progress',
  counts_for_streak: true,
  daily_proof: 'proof',
}

describe('guest records in storage (AC-37, AC-45)', () => {
  it('round-trips a valid record under one key per game, variant and day, and reads anything else as no record', () => {
    writeGuestRecord(KEY, RECORD)

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(RECORD))
    expect(readGuestRecord(KEY)).toEqual(RECORD)
    expect(readGuestRecords('game-guesser')).toEqual([
      { key: KEY, record: RECORD },
    ])

    const wrong = [
      { ...RECORD, guesses: [{ ...RECORD.guesses[0], title_id: '42' }] },
      // JSON leaves `status` out.
      { ...RECORD, status: undefined },
      'not JSON',
    ]
    for (const stored of wrong) {
      localStorage.setItem(
        STORAGE_KEY,
        typeof stored === 'string' ? stored : JSON.stringify(stored),
      )
      expect(readGuestRecord(KEY)).toBeUndefined()
    }
    expect(readGuestRecords('game-guesser')).toEqual([])
  })
})

describe('the records listed for stats, archive and merge (AC-40)', () => {
  it('lists the days with a guess, and leaves out a record that only keeps a proof', () => {
    writeGuestRecord(KEY, RECORD)
    const proofOnly: GuestRecord = {
      guesses: [],
      status: 'in_progress',
      counts_for_streak: null,
      daily_proof: 'proof',
    }
    writeGuestRecord({ ...KEY, date: '2026-11-04' }, proofOnly)

    expect(readGuestRecords('game-guesser')).toEqual([
      { key: KEY, record: RECORD },
    ])
    expect(readGuestRecord({ ...KEY, date: '2026-11-04' })).toEqual(proofOnly)
  })
})
