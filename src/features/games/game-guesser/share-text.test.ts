// @vitest-environment jsdom
import '@/test/dom-setup'
import { describe, expect, it } from 'vitest'
import type {
  GameGuesserView,
  GuessRead,
  GuessResult,
} from '@/api/generated/models'
import i18n from '@/i18n'
import { gameView } from '@/test/router-harness'
import { buildShareText } from './share-text'

const ORIGIN = 'https://dgc.example'
const t = i18n.getFixedT('en')

function guesses(results: GuessResult[]): GuessRead[] {
  return results.map((result, index) =>
    result === 'skipped'
      ? { title_id: null, name: null, result }
      : { title_id: index + 1, name: `Guessed Title ${index + 1}`, result },
  )
}

// A view full of what must never be shared: the answer, the names, a hint and signed media links.
function viewOf(
  results: GuessResult[],
  status: 'won' | 'lost',
  overrides: Partial<GameGuesserView> = {},
): GameGuesserView {
  return gameView({
    date: '2026-11-05',
    number: 308,
    status,
    guesses: guesses(results),
    guesses_used: results.length,
    answer: {
      title_id: 99,
      name: 'Secret Answer Name',
      year: 1998,
      franchise: 'Secret Series',
    },
    steps: [
      {
        step: 1,
        hint: { kind: 'critic_score', value: 'Hint Value 91' },
        media: {
          type: 'image',
          width: 640,
          height: 480,
          expires_at: '2099-01-01T00:00:00Z',
          poster: null,
          sources: [
            {
              content_type: 'image/webp',
              url: '/api/v1/media/1.webp?exp=4070908800&sig=abc',
            },
          ],
        },
        source_url: null,
      },
    ],
    ...overrides,
  })
}

// Only these fields reach the function, which is the rule: never the view itself.
function shareOf(view: GameGuesserView): string {
  return buildShareText(
    {
      number: view.number,
      date: view.date,
      slug: view.slug,
      results: view.guesses.map((guess) => guess.result),
      status: view.status,
      maxGuesses: view.max_guesses,
    },
    { t, origin: ORIGIN },
  )
}

function expectNoSpoiler(text: string, view: GameGuesserView) {
  const secrets = [
    view.answer?.name,
    view.answer?.franchise,
    ...view.guesses.map((guess) => guess.name),
    ...view.steps.map((step) => step.hint?.value),
    ...view.steps.flatMap((step) =>
      step.media.sources.map((source) => source.url),
    ),
    'sig=',
    '/media/',
  ]
  for (const secret of secrets) {
    if (secret) expect(text).not.toContain(secret)
  }
}

describe('the share text (AC-68, AC-69)', () => {
  it('has the title, one square per guess in order, the score and the link, and none of the view’s names, hints or media links, for a win, a loss and all skips', () => {
    // Skips count as guesses; every result has its own square.
    const won = viewOf(['wrong', 'franchise', 'skipped', 'correct'], 'won')
    expect(shareOf(won)).toBe(
      [
        'Daily Game Challenge: Game Guesser #308',
        '\u{1F7E5}\u{1F7E8}⬛\u{1F7E9}',
        '4/6',
        'https://dgc.example/games/game-guesser/2026-11-05',
      ].join('\n'),
    )

    const lost = viewOf(Array<GuessResult>(6).fill('wrong'), 'lost')
    expect(shareOf(lost).split('\n')).toEqual([
      'Daily Game Challenge: Game Guesser #308',
      '\u{1F7E5}'.repeat(6),
      'X/6',
      'https://dgc.example/games/game-guesser/2026-11-05',
    ])

    const skipped = viewOf(Array<GuessResult>(6).fill('skipped'), 'lost')
    expect(shareOf(skipped).split('\n')[1]).toBe('⬛'.repeat(6))
    expect(shareOf(skipped).split('\n')[2]).toBe('X/6')

    for (const view of [won, lost, skipped]) {
      expectNoSpoiler(shareOf(view), view)
    }

    // The same guesses give the same text, for a guest (with its proof and flag) and for an account.
    const guest = viewOf(['wrong', 'correct'], 'won', {
      signed_in: false,
      daily_proof: 'proof-token',
      counts_for_streak: true,
    })
    const account = viewOf(['wrong', 'correct'], 'won', {
      signed_in: true,
      daily_proof: null,
      counts_for_streak: null,
    })
    expect(shareOf(guest)).toBe(shareOf(account))
    expect(shareOf(guest)).not.toContain('proof-token')
  })
})
