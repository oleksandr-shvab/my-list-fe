import { useQuery } from '@tanstack/react-query'
import { GAMES, findGame, getDefaultGame } from './registry'
import { gamesQueryOptions, slugsOf } from './queries'
import type { GameEntry } from './types'

// What the shell shows is the games both sides know: the registry (screens, names, order) and the
// backend's list of enabled games. `slugs` is that list, or `undefined` while it is pending or
// after it failed; then the registry alone decides (AC-8).

export function knownGames(
  slugs: ReadonlySet<string> | undefined,
  games: readonly GameEntry[] = GAMES,
): GameEntry[] {
  return games
    .filter((game) => slugs === undefined || slugs.has(game.slug))
    .toSorted((a, b) => a.order - b.order)
}

export function findKnownGame(
  slug: string,
  slugs: ReadonlySet<string> | undefined,
): GameEntry | undefined {
  const game = findGame(slug)
  return game && (slugs === undefined || slugs.has(slug)) ? game : undefined
}

export function isDefaultKnown(
  slugs: ReadonlySet<string> | undefined,
): boolean {
  return slugs === undefined || slugs.has(getDefaultGame().slug)
}

// The games for the navigation, derived from the query on every render.
export function useKnownGames(): GameEntry[] {
  const { data } = useQuery(gamesQueryOptions())
  return knownGames(data && slugsOf(data))
}
