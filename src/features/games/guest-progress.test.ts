// @vitest-environment jsdom
import '@/test/dom-setup'
import { describe, expect, it } from 'vitest'
import { gameView } from '@/test/router-harness'
import i18n from '@/i18n'
import { recordGuestAnswer, withKnownValues } from './guest-progress'
import { readGuestRecord } from './guest-records'

const KEY = { slug: 'game-guesser', variant: 'default', date: '2026-11-05' }
const SKIP = { title_id: null, name: null, result: 'skipped' } as const
const DOOM = { title_id: 42, name: 'Doom', result: 'wrong' } as const

describe('what a guest answer leaves in the record (AC-40, AC-41, AC-50, R-4)', () => {
  it('keeps the proof before a guess and the first answer’s flag after later nulls, takes the answer’s whole list, and stores nothing for an account', () => {
    // A view before any guess: only the proof is kept.
    recordGuestAnswer(
      gameView({ signed_in: false, daily_proof: 'proof' }),
      false,
    )
    expect(readGuestRecord(KEY)).toEqual({
      guesses: [],
      status: 'in_progress',
      counts_for_streak: null,
      daily_proof: 'proof',
    })

    // The first guess says whether it counts for the streak.
    recordGuestAnswer(
      gameView({
        signed_in: false,
        counts_for_streak: true,
        guesses: [DOOM],
      }),
      true,
    )
    // A later answer carries null for both, and the list is the answer's, not the old record plus one.
    recordGuestAnswer(
      gameView({
        signed_in: false,
        counts_for_streak: null,
        daily_proof: null,
        status: 'lost',
        guesses: [DOOM, SKIP],
      }),
      true,
    )
    expect(readGuestRecord(KEY)).toEqual({
      guesses: [DOOM, SKIP],
      status: 'lost',
      counts_for_streak: true,
      daily_proof: 'proof',
    })

    // An account's game is the server's.
    recordGuestAnswer(
      gameView({ signed_in: true, guesses: [DOOM], date: '2026-11-04' }),
      true,
    )
    expect(readGuestRecord({ ...KEY, date: '2026-11-04' })).toBeUndefined()
  })
})

describe('what a record holds (AC-37)', () => {
  it('has the guesses, status and the two server values, and nothing of the answer, the media or the language', async () => {
    await i18n.changeLanguage('ru')
    recordGuestAnswer(
      gameView({
        signed_in: false,
        status: 'won',
        counts_for_streak: true,
        daily_proof: 'proof',
        answer: { title_id: 7, name: 'Zelda', year: 1998, franchise: null },
        guesses: [{ ...DOOM, extra: 'Secret' } as typeof DOOM],
        steps: [
          {
            step: 1,
            hint: null,
            media: {
              type: 'image',
              width: 1,
              height: 1,
              expires_at: '2099-01-01T00:00:00Z',
              poster: null,
              sources: [{ content_type: 'image/webp', url: '/api/v1/media/1' }],
            },
            source_url: 'https://example.com/source',
          },
        ],
      }),
      true,
    )
    await i18n.changeLanguage('en')

    expect(
      Object.keys(localStorage).filter((key) => key.startsWith('dgc.')),
    ).toEqual(['dgc.guest.v1.game-guesser.default.2026-11-05'])
    const raw = JSON.parse(
      localStorage.getItem('dgc.guest.v1.game-guesser.default.2026-11-05')!,
    )
    expect(Object.keys(raw).sort()).toEqual([
      'counts_for_streak',
      'daily_proof',
      'guesses',
      'status',
    ])
    expect(raw.guesses).toEqual([DOOM])
  })
})

describe('what a resume answer gets back from the record (AC-40)', () => {
  it('takes the two values the answer leaves null, keeps what the answer says, and leaves an account answer alone', () => {
    const record = {
      guesses: [DOOM],
      status: 'in_progress' as const,
      counts_for_streak: true,
      daily_proof: 'kept',
    }
    const nulls = gameView({
      signed_in: false,
      counts_for_streak: null,
      daily_proof: null,
    })

    expect(withKnownValues(nulls, record)).toMatchObject({
      counts_for_streak: true,
      daily_proof: 'kept',
    })
    expect(
      withKnownValues(
        { ...nulls, counts_for_streak: false, daily_proof: 'new' },
        record,
      ),
    ).toMatchObject({ counts_for_streak: false, daily_proof: 'new' })
    expect(
      withKnownValues({ ...nulls, signed_in: true }, record),
    ).toMatchObject({
      counts_for_streak: null,
      daily_proof: null,
    })
  })
})
