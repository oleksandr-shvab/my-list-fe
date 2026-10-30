import { createFileRoute } from '@tanstack/react-router'
import { GameScreen } from '@/features/games/game-screen'

// A game's screen for today (AC-40).
export const Route = createFileRoute('/_app/games/$slug/')({
  beforeLoad: ({ context }) => ({ date: context.today, isToday: true }),
  component: TodayPage,
})

function TodayPage() {
  const { game, date, isToday } = Route.useRouteContext()

  return <GameScreen game={game} date={date} isToday={isToday} />
}
