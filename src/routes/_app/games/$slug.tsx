import { createFileRoute, notFound } from '@tanstack/react-router'
import { findKnownGame } from '@/features/games/known-games'
import { knownGameSlugs } from '@/features/games/queries'
import { findGame } from '@/features/games/registry'
import { UnknownGame } from '@/features/games/unknown-game'
import { GAME_NAME_TITLE } from '@/lib/page-title'
import { todayUtc } from '@/lib/utc-date'

// The slug comes from the address, so it must match a registry slug exactly (AC-43) and be in the backend list (AC-7).
// When the list cannot be read, the registry alone decides (AC-8).
export const Route = createFileRoute('/_app/games/$slug')({
  staticData: { pageTitle: GAME_NAME_TITLE },
  beforeLoad: async ({ params, context }) => {
    // The registry check comes first, so an unknown slug never waits for the list.
    if (!findGame(params.slug)) throw notFound()
    const game = findKnownGame(
      params.slug,
      await knownGameSlugs(context.queryClient),
    )
    if (!game) throw notFound()
    // "Today" is read once per load, so an open page keeps its day past 00:00 UTC.
    return { game, today: todayUtc() }
  },
  notFoundComponent: UnknownGame,
})
