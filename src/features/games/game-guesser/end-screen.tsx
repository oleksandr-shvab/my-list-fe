import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { GameGuesserView } from '@/api/generated/models'
import { Button, buttonVariants } from '@/components/ui/button'
import type { ServerClock } from '@/features/clock/clock'
import { Countdown } from '@/features/clock/countdown'
import { cn } from '@/lib/utils'
import { SignUpNudge } from '../sign-up-nudge'
import { GuessList } from './guess-list'
import { buildShareText } from './share-text'

type EndScreenProps = {
  slug: string
  // The Statistics button, built by the game screen with the mark for this game's guess count.
  statsButton: ReactNode
  // A won or a lost game.
  view: GameGuesserView
  // The game ended while the player was on the page, so the heading takes the focus (AC-64). A finished puzzle that is
  // opened leaves the focus alone.
  focusHeading: boolean
  // The page got its puzzle from `/today` when it opened.
  openedAsToday: boolean
  // The page's one reader of the clock query (a second reader mounting with the end screen would ask a failed clock
  // again).
  clock: ServerClock
  // The day-change message is showing, and it carries the link to today's puzzle: the end screen adds none of its own.
  dayChanged: boolean
  // The countdown is at zero: the page checks whether its day has moved (AC-48).
  onCountdownZero: () => void
}

type ShareState = 'idle' | 'copied' | 'failed'

const LINK_BUTTON = cn(buttonVariants({ variant: 'outline' }), 'max-md:h-11')

export function EndScreen({
  slug,
  statsButton,
  view,
  focusHeading,
  openedAsToday,
  clock,
  dayChanged,
  onCountdownZero,
}: EndScreenProps) {
  const { t } = useTranslation()
  const [share, setShare] = useState<ShareState>('idle')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const latestAttempt = useRef(0)

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus()
  }, [focusHeading])

  // The text is selected, with the focus in the box, so Ctrl+C or a long press copies it (AC-67).
  useEffect(() => {
    if (share !== 'failed') return
    textRef.current?.focus()
    textRef.current?.select()
  }, [share])

  const won = view.status === 'won'
  const answer = view.answer
  const text = buildShareText(
    {
      number: view.number,
      date: view.date,
      slug,
      results: view.guesses.map((guess) => guess.result),
      status: view.status,
      maxGuesses: view.max_guesses,
    },
    { t, origin: window.location.origin },
  )

  // The status line is emptied and drawn before the attempt (`flushSync`): a missing clipboard fails in the same tick,
  // and a second press with the same outcome would otherwise change nothing, neither the text a screen reader hears nor
  // the selection of the box (AC-66, AC-67).
  // Only the last press counts: a slow earlier copy that ends after a later press must not overwrite its result.
  async function copyResult() {
    const attempt = ++latestAttempt.current
    flushSync(() => setShare('idle'))
    try {
      await navigator.clipboard.writeText(text)
      if (attempt === latestAttempt.current) setShare('copied')
    } catch {
      // Refused (permissions) or missing (an old browser, an insecure page).
      if (attempt === latestAttempt.current) setShare('failed')
    }
  }

  // The server's today decides (Q9); the device's day is not asked. When the clock call failed, the page's own opening
  // (the server's `/today`) is all there is to go by, and the countdown then runs on the device's clock (AC-102).
  const isToday =
    clock.source === 'server' ? view.date === clock.today : openedAsToday
  // The day-change message carries this link (`useDayChange`, by the server's clock), so while it shows the end screen has
  // none of its own. At zero on a page that opened as today the message is about to show (`onZero` checks), so the
  // countdown leaves the link out from the start, with no frame that has two.
  const dayMessageComing = openedAsToday && clock.source === 'server'
  const playToday = (
    <Link
      to="/games/$slug"
      params={{ slug }}
      className={cn(buttonVariants(), 'max-md:h-11')}
    >
      {t('games.play_today')}
    </Link>
  )

  return (
    <section className="flex flex-col gap-3">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-medium">
        {won ? t('games.win') : t('games.lose')}
      </h2>
      {won && <p>{t('games.solved_in', { count: view.guesses_used })}</p>}
      {answer && (
        <div>
          <p className="font-medium">
            {answer.year === null
              ? t('games.answer_no_year', { name: answer.name })
              : t('games.answer', { name: answer.name, year: answer.year })}
          </p>
          {answer.franchise !== null && (
            <p className="text-sm text-muted-foreground">
              {t('games.franchise_line', { franchise: answer.franchise })}
            </p>
          )}
        </div>
      )}

      <GuessList guesses={view.guesses} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="max-md:h-11"
          onClick={() => void copyResult()}
        >
          {t('games.share')}
        </Button>
        {statsButton}
        <Link
          to="/games/$slug/archive"
          params={{ slug }}
          className={LINK_BUTTON}
        >
          {t('games.play_previous')}
        </Link>
      </div>

      {/* Always there, so the copy result is announced when it arrives (AC-66). */}
      <p role="status" className="text-sm">
        {share === 'copied' && t('games.share_copied')}
        {share === 'failed' && t('games.share_failed')}
      </p>
      {share === 'failed' && (
        <textarea
          ref={textRef}
          readOnly
          rows={5}
          value={text}
          aria-label={t('games.share_text_label')}
          className="w-full max-w-md rounded-lg border bg-background p-2 font-mono text-sm"
        />
      )}

      {/* Only a guest's win: the account already has its games (AC-90, AC-92). */}
      {won && !view.signed_in && (
        <SignUpNudge
          slug={slug}
          date={view.date}
          onDismiss={() => headingRef.current?.focus()}
        />
      )}

      {/* Nothing until the clock has answered or failed: the server's today decides which of the two shows. */}
      {clock.ready &&
        (isToday ? (
          <Countdown
            clock={clock}
            onZero={onCountdownZero}
            action={dayChanged || dayMessageComing ? null : playToday}
          />
        ) : (
          !dayChanged && <div>{playToday}</div>
        ))}
    </section>
  )
}
