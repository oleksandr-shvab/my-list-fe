import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameGuesserView } from '@/api/generated/models'
import { Button } from '@/components/ui/button'
import { useServerClock } from '@/features/clock/clock'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage } from '@/lib/error-messages'
import { formatPuzzleDate } from '@/lib/utc-date'
import { ClueLadder } from '../clue-ladder/clue-ladder'
import { isGameChanged, useGuess } from '../guess'
import { isInvalidHistory } from '../guest-progress'
import { useRefreshLinks } from '../refresh-links'
import { useDayChange } from '../use-day-change'
import type { Viewer } from '../view-queries'
import { GuessList } from './guess-list'
import { RESULT_KEYS } from './results'
import { TitleSearch } from './title-search'

function newestStep(view: GameGuesserView): number {
  return Math.max(1, ...view.steps.map((step) => step.step))
}

type GuesserGameProps = {
  slug: string
  // The day of the puzzle shown, also on a page whose address has no date.
  date: string
  viewer: Viewer
  view: GameGuesserView
  // The page had no date in its address: it keeps the puzzle it opened with, so it is never an archive page.
  openedAsToday: boolean
}

export function GuesserGame({
  slug,
  date,
  viewer,
  view,
  openedAsToday,
}: GuesserGameProps) {
  const { t, i18n } = useTranslation()
  const clock = useServerClock()
  // The page keeps its puzzle across midnight; a guess that is really sent is one of the moments it says that the day
  // has moved (AC-48).
  const dayChange = useDayChange(openedAsToday ? date : null)
  const guess = useGuess({
    target: { slug, date, viewer },
    view,
    onSend: dayChange.check,
  })
  const refreshLinks = useRefreshLinks({ target: { slug, date, viewer }, view })

  // A new step is selected when it is earned (AC-10). The screen owns the selection, so it survives a language
  // switch (AC-107).
  const newest = newestStep(view)
  const [selection, setSelection] = useState({ step: newest, newest })
  if (selection.newest !== newest) setSelection({ step: newest, newest })

  // A game begun before 00:00 UTC still counts for the streak, so the server's flag comes first. A game not begun
  // is an archive one when the server's today (not the device's fallback) is later than its date.
  const isArchivePuzzle =
    !openedAsToday &&
    (view.counts_for_streak === false ||
      (view.counts_for_streak === null &&
        clock.source === 'server' &&
        view.date < clock.today))

  const inProgress = view.status === 'in_progress'
  const answer = view.answer

  // The status line says what happened to the last guess, or why it failed (AC-61, AC-62, AC-110).
  let message = ''
  if (guess.error) {
    // A guest's damaged record is dropped and the puzzle starts again; the server's own text is for the merge.
    message = isInvalidHistory(guess.error)
      ? t('games.progress_damaged')
      : isGameChanged(guess.error)
        ? t('games.game_changed')
        : guess.error instanceof ApiError
          ? getErrorMessage(guess.error, t)
          : t('errors.unknown')
  } else if (guess.answer) {
    const last = guess.answer.guesses.at(-1)
    if (last) {
      const result = t(RESULT_KEYS[last.result])
      message =
        guess.answer.status === 'in_progress'
          ? t('games.announce', {
              result,
              n: newestStep(guess.answer),
              left: t('games.guesses_left', {
                count: guess.answer.guesses_left,
              }),
            })
          : result
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium">{t('games.game_guesser.name')}</h1>
        <p className="text-muted-foreground">
          {t('games.puzzle_line', {
            number: view.number,
            date: formatPuzzleDate(view.date, i18n.language),
          })}
        </p>
        {/* The server decides what is an archive puzzle, never the device (AC-88). */}
        {isArchivePuzzle && (
          <p className="text-sm text-muted-foreground">
            {t('games.archive_marker')}
          </p>
        )}
      </header>

      {/* The region is always there, so the message is announced when it arrives (AC-62). */}
      <div role="status" className="text-sm">
        {dayChange.changed && (
          <p>
            {t('games.day_changed')}{' '}
            <Link
              to="/games/$slug"
              params={{ slug }}
              className="font-medium underline underline-offset-4"
            >
              {t('games.play_today')}
            </Link>
          </p>
        )}
      </div>

      <ClueLadder
        steps={view.steps}
        totalSteps={view.max_guesses}
        selected={selection.step}
        onSelect={(step) => setSelection({ step, newest })}
        onRefreshLinks={refreshLinks}
      />

      <GuessList guesses={view.guesses} />

      {inProgress && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {t('games.guesses_left', { count: view.guesses_left })}
          </p>
          {/* aria-disabled, not disabled: the focus stays on the button while a request runs (AC-16). */}
          <Button
            type="button"
            variant="outline"
            aria-disabled={guess.isPending}
            className="max-md:h-11"
            onClick={() => guess.send(null)}
          >
            {t('games.skip')}
          </Button>
        </div>
      )}

      {inProgress && (
        <TitleSearch slug={slug} guesses={view.guesses} guess={guess} />
      )}

      <p
        role="status"
        className={guess.error ? 'text-sm text-destructive' : 'text-sm'}
      >
        {message}
      </p>

      {/* Until the end screen (M1-33) the answer shows as plain text, and only from the view. */}
      {answer && (
        <p className="font-medium">
          {answer.year === null
            ? t('games.answer_no_year', { name: answer.name })
            : t('games.answer', { name: answer.name, year: answer.year })}
        </p>
      )}
    </div>
  )
}
