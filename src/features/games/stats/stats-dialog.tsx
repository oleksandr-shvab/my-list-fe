import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { InlineError } from '@/components/inline-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { GameGuesserView } from '@/api/generated/models'
import { serverToday, type ServerClock } from '@/features/clock/clock'
import { ApiError } from '@/lib/api-client'
import { DEFAULT_VARIANT, readGuestRecords } from '../guest-records'
import { computeGuestStats } from './compute-guest-stats'
import { statsQueryOptions } from './queries'
import type { StatsFigures } from './stats-figures'

// What the dialog needs from the page; the page builds it once for every button.
export type StatsSource = {
  slug: string
  viewer: string
  // The shown game: `signed_in` says where its stats live, and its guesses and status say when they have changed.
  view: GameGuesserView
  // The page's one reader of the clock query; a guest's "today" comes from its offset (AC-74, AC-76).
  clock: ServerClock
}

type StatsDialogProps = StatsSource & {
  // The guess count of the game that just ended: its bar is marked (AC-72). Null from the game screen's header.
  highlight?: number | null
  className?: string
}

// The button and the dialog it opens: Radix returns the focus to the button that opened it, keeps it inside while open
// and closes on Escape (AC-78).
export function StatsDialog({
  highlight = null,
  className,
  ...source
}: StatsDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={className}>
          {t('games.stats.button')}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('games.stats.title')}</DialogTitle>
        </DialogHeader>
        {source.view.signed_in ? (
          <AccountStats source={source} highlight={highlight} />
        ) : (
          <GuestStatsView source={source} highlight={highlight} />
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="max-md:h-11">
              {t('games.stats.close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type BodyProps = { source: StatsSource; highlight: number | null }

function AccountStats({ source, highlight }: BodyProps) {
  const { slug, viewer, view } = source
  const stats = useQuery(statsQueryOptions(slug, viewer, progressOf(view)))

  // A 401 means the session ended (the guard has signed the page out): the guest's numbers are the ones to show
  // (AC-79).
  if (stats.error instanceof ApiError && stats.error.status === 401) {
    return <GuestStatsView source={source} highlight={highlight} />
  }
  // A failed refetch behind numbers that are shown leaves the numbers (the error is for a dialog with nothing to show).
  if (stats.isError && !stats.isFetching && !stats.data) {
    return (
      <InlineError
        error={stats.error}
        fallbackKey="games.stats.load_failed"
        retryKey="games.stats.retry"
        onRetry={() => void stats.refetch()}
      />
    )
  }
  return (
    <StatsNumbers
      maxGuesses={view.max_guesses}
      highlight={highlight}
      stats={
        stats.data
          ? {
              played: stats.data.played,
              wins: stats.data.wins,
              // Null only for a variant with no streak; this dialog is for the default one.
              currentStreak: stats.data.current_streak ?? 0,
              maxStreak: stats.data.max_streak ?? 0,
              distribution: stats.data.distribution,
            }
          : null
      }
    />
  )
}

function GuestStatsView({ source, highlight }: BodyProps) {
  const { t } = useTranslation()
  const { slug, view, clock } = source
  const href = useLocation({ select: (location) => location.href })
  // Read on every render, so a guess still on its way when the dialog opened shows once it is answered; today comes
  // from the server's clock now, not as of its answer (AC-74, AC-76).
  const stats = computeGuestStats({
    plays: readGuestRecords(slug).map(({ key, record }) => ({
      variant: key.variant,
      date: key.date,
      status: record.status,
      guessesUsed: record.guesses.length,
      countsForStreak: record.counts_for_streak === true,
    })),
    today: serverToday(clock),
    maxGuesses: view.max_guesses,
    variant: DEFAULT_VARIANT,
  })

  return (
    <>
      <StatsNumbers
        maxGuesses={view.max_guesses}
        highlight={highlight}
        stats={stats}
      />
      <p className="text-sm text-muted-foreground">
        {t('games.stats.guest_note')}{' '}
        <Link
          to="/register"
          search={{ redirect: href }}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t('games.stats.sign_up')}
        </Link>
      </p>
    </>
  )
}

// Changes when the shown game does: the account's stats are asked for again.
function progressOf(view: GameGuesserView): string {
  return `${view.guesses_used}:${view.status}`
}

function winPercent({ played, wins }: StatsFigures): number {
  return played === 0 ? 0 : Math.round((wins / played) * 100)
}

type StatsNumbersProps = {
  // Null while the numbers load: the same layout with placeholders (AC-73).
  stats: StatsFigures | null
  maxGuesses: number
  highlight: number | null | undefined
}

function StatsNumbers({ stats, maxGuesses, highlight }: StatsNumbersProps) {
  const { t } = useTranslation()
  const figures = [
    { label: t('games.stats.played'), value: stats?.played },
    {
      label: t('games.stats.win_rate'),
      value: stats ? winPercent(stats) : undefined,
    },
    { label: t('games.stats.current_streak'), value: stats?.currentStreak },
    { label: t('games.stats.max_streak'), value: stats?.maxStreak },
  ]
  const guessCounts = Array.from({ length: maxGuesses }, (_, i) => i + 1)
  const tallest = Math.max(
    1,
    ...guessCounts.map((count) => stats?.distribution[count] ?? 0),
  )

  return (
    <div className="flex flex-col gap-4" aria-busy={stats === null}>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {figures.map(({ label, value }) => (
          // The label comes first in the markup and below the figure on screen.
          <div key={label} className="flex flex-col-reverse items-center gap-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="flex h-8 items-center text-2xl font-medium">
              {value === undefined ? <Skeleton className="h-7 w-8" /> : value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{t('games.stats.distribution')}</h3>
        <ul className="flex flex-col gap-1">
          {guessCounts.map((count) => {
            const wins = stats ? (stats.distribution[count] ?? 0) : undefined
            const marked = highlight === count
            return (
              <li key={count} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-right tabular-nums">{count}</span>
                <div className="h-6 flex-1">
                  {wins === undefined ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={
                        marked
                          ? 'h-full rounded-sm bg-primary'
                          : 'h-full rounded-sm bg-muted-foreground/40'
                      }
                      style={{ width: `${(wins / tallest) * 100}%` }}
                    />
                  )}
                </div>
                <div className="w-6 tabular-nums">
                  {wins ?? <Skeleton className="h-4 w-5" />}
                </div>
                {/* Said in words too: a colour alone marks nothing. */}
                {marked && (
                  <span className="text-xs font-medium">
                    {t('games.stats.this_game')}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
