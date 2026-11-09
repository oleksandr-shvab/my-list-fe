import { createFileRoute, notFound } from '@tanstack/react-router'
import { GameScreen } from '@/features/games/game-screen'
import { isDefaultKnown } from '@/features/games/known-games'
import { knownGameSlugs } from '@/features/games/queries'
import { getDefaultGame } from '@/features/games/registry'
import { nextOpening } from '@/features/games/openings'
import { UnknownGame } from '@/features/games/unknown-game'
import { GAME_NAME_TITLE } from '@/lib/page-title'

// The home page is the default game's screen for today, with no redirect (AC-39, AC-42).
// An unknown default game shows "Unknown game" (AC-8).
export const Route = createFileRoute('/_app/')({
  staticData: { pageTitle: GAME_NAME_TITLE },
  beforeLoad: async ({ context }) => {
    if (!isDefaultKnown(await knownGameSlugs(context.queryClient))) {
      throw notFound()
    }
    return { game: getDefaultGame(), date: null, opening: nextOpening() }
  },
  notFoundComponent: UnknownGame,
  component: HomePage,
})

function HomePage() {
  const { game, date, opening } = Route.useRouteContext()

  return <GameScreen game={game} date={date} opening={opening} />
}
