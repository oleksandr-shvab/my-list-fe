import type { TFunction } from 'i18next'
import type { GuessResult, ProgressStatus } from '@/api/generated/models'

// What goes into a shared result is only what is listed here (AC-68, AC-69): the puzzle's number and day, its page, the
// results in order, the end status and the guess limit. The view is not an input, so no title, hint or media link can
// get into the text.
export type ShareInput = {
  number: number
  date: string
  slug: string
  results: readonly GuessResult[]
  status: ProgressStatus
  maxGuesses: number
}

// Green, yellow, red, black.
const SQUARES: Record<GuessResult, string> = {
  correct: '\u{1F7E9}',
  franchise: '\u{1F7E8}',
  wrong: '\u{1F7E5}',
  skipped: '⬛',
}

// The words (site name, game name) follow the language of `t`; `origin` is the site's address.
export function buildShareText(
  { number, date, slug, results, status, maxGuesses }: ShareInput,
  { t, origin }: { t: TFunction; origin: string },
): string {
  const title = t('games.share_title', {
    app: t('app.name'),
    game: t('games.game_guesser.name'),
    number,
  })
  const squares = results.map((result) => SQUARES[result]).join('')
  // Skips count as guesses; a loss has no number.
  const score = `${status === 'won' ? results.length : 'X'}/${maxGuesses}`
  return [title, squares, score, `${origin}/games/${slug}/${date}`].join('\n')
}
