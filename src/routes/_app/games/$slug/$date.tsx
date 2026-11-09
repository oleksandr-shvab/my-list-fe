import { createFileRoute, notFound } from '@tanstack/react-router'
import { GameScreen } from '@/features/games/game-screen'
import { NoPuzzle } from '@/features/games/no-puzzle'
import { parsePuzzleDate } from '@/lib/utc-date'

// The day must be a real YYYY-MM-DD day (AC-3). Whether a puzzle exists for it is the backend's answer, which the
// screen shows. Today's date gives the same screen as the page without a date, with no redirect.
export const Route = createFileRoute('/_app/games/$slug/$date')({
  beforeLoad: ({ params }) => {
    const date = parsePuzzleDate(params.date)
    if (!date) throw notFound()
    return { date }
  },
  notFoundComponent: NoPuzzle,
  component: DatePage,
})

function DatePage() {
  const { game, date } = Route.useRouteContext()

  return <GameScreen game={game} date={date} />
}
