import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { gamesListGames } from '@/api/generated/api'
import type { GameList } from '@/api/generated/models'

// The backend sends `public, max-age=300` for this list, so the client keeps it as long.
const GAMES_STALE_TIME = 5 * 60 * 1000

export function gamesQueryOptions() {
  return queryOptions({
    queryKey: ['games'] as const,
    queryFn: ({ signal }) => gamesListGames({ signal }),
    // A failed call falls back to the registry (AC-8), and a retry would only delay the page.
    retry: false,
    staleTime: GAMES_STALE_TIME,
  })
}

export function slugsOf(list: GameList): ReadonlySet<string> {
  return new Set(list.items.map((item) => item.slug))
}

// For route guards: never throws, because a failed call must not block the page.
export async function knownGameSlugs(
  queryClient: QueryClient,
): Promise<ReadonlySet<string> | undefined> {
  try {
    return slugsOf(await queryClient.query(gamesQueryOptions()))
  } catch {
    return undefined
  }
}
