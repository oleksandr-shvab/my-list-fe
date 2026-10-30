import { createFileRoute } from '@tanstack/react-router'
import { GameScreen } from '@/features/games/game-screen'
import { getDefaultGame } from '@/features/games/registry'
import { GAME_NAME_TITLE } from '@/lib/page-title'
import { todayUtc } from '@/lib/utc-date'

// The home page is the default game's screen for today, with no redirect (AC-39, AC-42).
export const Route = createFileRoute('/_app/')({
  staticData: { pageTitle: GAME_NAME_TITLE },
  beforeLoad: () => ({
    game: getDefaultGame(),
    date: todayUtc(),
    isToday: true,
  }),
  component: HomePage,
})

function HomePage() {
  const { game, date, isToday } = Route.useRouteContext()

  return <GameScreen game={game} date={date} isToday={isToday} />
}
