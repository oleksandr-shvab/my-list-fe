import { queryOptions } from '@tanstack/react-query'
import { gamesGetStats } from '@/api/generated/api'

// The account's numbers for the game's default variant. They are not kept, and `progress` (guesses and status of the
// shown game) is in the key, so an old answer never shows once the game has moved on.
export function statsQueryOptions(
  slug: string,
  viewer: string,
  progress: string,
) {
  return queryOptions({
    queryKey: ['game-stats', slug, viewer, progress] as const,
    queryFn: ({ signal }) => gamesGetStats(slug, undefined, { signal }),
    gcTime: 0,
    // A 401 (the session ended, AC-79) and a 404 are answers the dialog handles, not faults to report.
    meta: { expectedStatuses: [401, 404] },
  })
}
