import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameGuesserView } from '@/api/generated/models'
import { ErrorScreen } from '@/components/error-screen'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session'
import { ApiError } from '@/lib/api-client'
import { NoPuzzle, NoPuzzleToday } from '../no-puzzle'
import type { GameScreenProps } from '../types'
import { UnknownGame } from '../unknown-game'
import {
  GUEST_VIEWER,
  UNCONFIRMED_VIEWER,
  gameViewQueryOptions,
  todayViewQueryOptions,
  type Viewer,
} from '../view-queries'
import { GuesserGame } from './guesser-game'

const UNKNOWN_VIEW_TYPE = new Error(
  'The view has a type this app does not know',
)

// Default export, so the registry can load it with a plain `lazy(() => import(...))`.
export default function GameGuesserScreen({ slug, date }: GameScreenProps) {
  const session = useSession()
  // A failed session check is not a guest: the key says so, and each answer's `signed_in` decides what it is.
  const viewer =
    session.user?.id ??
    (session.status === 'guest' ? GUEST_VIEWER : UNCONFIRMED_VIEWER)
  // The key names the viewer, so wait until the session check says who it is (R-2).
  const ready = session.status !== 'pending'

  // A page without a date asks for today once and keeps the day of that answer: a refetch, a retry or a sign-in
  // later asks for that day, never for "today" again (AC-2, AC-47). The state lives as long as the screen.
  const [pinned, setPinned] = useState<string | null>(null)
  const opening = useId()
  const today = useQuery(
    todayViewQueryOptions(
      { slug, viewer, opening },
      ready && date === null && pinned === null,
    ),
  )
  if (date === null && pinned === null && today.data) {
    setPinned(today.data.date)
  }

  const openDate = date ?? pinned
  if (openDate === null) return <ViewStatus result={today} noPuzzleToday />
  return (
    <DatedGame
      slug={slug}
      date={openDate}
      viewer={viewer}
      ready={ready}
      todayPage={date === null}
    />
  )
}

type DatedGameProps = {
  slug: string
  date: string
  viewer: Viewer
  ready: boolean
  todayPage: boolean
}

function DatedGame({ slug, date, viewer, ready, todayPage }: DatedGameProps) {
  const dated = useQuery(gameViewQueryOptions({ slug, date, viewer }, ready))
  const view = dated.data

  if (view?.type === 'game_guesser') {
    return (
      <GuesserGame
        slug={slug}
        date={date}
        viewer={viewer}
        view={view}
        openedAsToday={todayPage}
      />
    )
  }
  return <ViewStatus result={dated} noPuzzleToday={todayPage} />
}

// What the screen shows while it has no game to show: the placeholder, or why there is none.
function ViewStatus({
  result,
  noPuzzleToday = false,
}: {
  result: UseQueryResult<GameGuesserView>
  noPuzzleToday?: boolean
}) {
  const { t } = useTranslation()
  const heading = <h1 className="sr-only">{t('games.game_guesser.name')}</h1>

  // Data that got here is a view of a type this app does not know: a later game's. An old tab shows an error (AC-5).
  const failure = result.data
    ? UNKNOWN_VIEW_TYPE
    : result.isError && !result.isFetching
      ? result.error
      : null

  if (failure) {
    if (failure instanceof ApiError && failure.status === 404) {
      if (failure.code === 'puzzle_not_found') {
        return noPuzzleToday ? <NoPuzzleToday /> : <NoPuzzle />
      }
      if (failure.code === 'game_not_found') return <UnknownGame />
    }
    return (
      <>
        {heading}
        <ErrorScreen
          error={failure}
          // The same JSON would come again: a newer version of the app may know the type.
          onRetry={() =>
            failure === UNKNOWN_VIEW_TYPE
              ? window.location.reload()
              : void result.refetch()
          }
        />
      </>
    )
  }

  // The same shape as the game, so nothing jumps when it arrives (AC-6).
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-4">
      {heading}
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="aspect-4/3 w-full max-w-xl" />
      <Skeleton className="h-8 w-40" />
    </div>
  )
}
