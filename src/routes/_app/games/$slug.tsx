import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundMessage } from '@/components/error-screen'
import { findGame } from '@/features/games/registry'
import { GAME_NAME_TITLE } from '@/lib/page-title'
import { todayUtc } from '@/lib/utc-date'

// The pages of one game. The slug is checked here, so every page below it can rely on `game`.
// It comes from the address, so it must match a registry slug exactly (AC-43).
export const Route = createFileRoute('/_app/games/$slug')({
  staticData: { pageTitle: GAME_NAME_TITLE },
  beforeLoad: ({ params }) => {
    const game = findGame(params.slug)
    if (!game) throw notFound()
    // "Today" is read once per load, so an open page keeps its day past 00:00 UTC.
    return { game, today: todayUtc() }
  },
  notFoundComponent: UnknownGame,
})

function UnknownGame() {
  return (
    <NotFoundMessage
      titleKey="games.unknown_game"
      textKey="games.unknown_game_text"
    />
  )
}
