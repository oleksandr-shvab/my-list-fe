import { createFileRoute } from '@tanstack/react-router'
import { GameScreen } from '@/features/games/game-screen'
import { nextOpening } from '@/features/games/openings'

export const Route = createFileRoute('/_app/games/$slug/')({
  // No date in the address: the screen asks the server for today's puzzle.
  beforeLoad: () => ({ date: null, opening: nextOpening() }),
  component: TodayPage,
})

function TodayPage() {
  const { game, date, opening } = Route.useRouteContext()

  return <GameScreen game={game} date={date} opening={opening} />
}
