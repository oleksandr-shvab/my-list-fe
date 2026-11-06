import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundMessage } from '@/components/error-screen'
import { GameScreen } from '@/features/games/game-screen'
import { parsePuzzleDate } from '@/lib/utc-date'

// The day must be a real YYYY-MM-DD day not after today in UTC (AC-44, AC-45). Today gives the same screen as the page
// without a date, with no redirect (AC-41b).
export const Route = createFileRoute('/_app/games/$slug/$date')({
  beforeLoad: ({ context, params }) => {
    const puzzle = parsePuzzleDate(params.date, context.today)
    if (!puzzle) throw notFound()
    return puzzle
  },
  notFoundComponent: NoPuzzle,
  component: DatePage,
})

function NoPuzzle() {
  return (
    <NotFoundMessage
      titleKey="games.no_puzzle"
      textKey="games.no_puzzle_text"
    />
  )
}

function DatePage() {
  const { game, date, isToday } = Route.useRouteContext()

  return <GameScreen game={game} date={date} isToday={isToday} />
}
