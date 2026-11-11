import { infiniteQueryOptions } from '@tanstack/react-query'
import { gamesListArchive } from '@/api/generated/api'
import { refreshSession } from '@/features/auth/session'
import { needsSessionCheck } from './archive-state'

const PAGE_SIZE = 30

// One key per game and viewer. The first page has no `before` (the server's default is today, which it never lists).
export function archiveQueryOptions(slug: string, viewer: string) {
  return infiniteQueryOptions({
    queryKey: ['archive', slug, viewer] as const,
    queryFn: async ({ pageParam, signal, client }) => {
      const page = await gamesListArchive(
        slug,
        {
          limit: PAGE_SIZE,
          ...(pageParam === null ? {} : { before: pageParam }),
        },
        { signal },
      )
      // An answer for another session than the page holds: ask who is signed in, as `checkSessionOfView` does.
      if (needsSessionCheck(viewer, page.items)) void refreshSession(client)
      return page
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_before,
    // A 404 (the game was switched off since the page opened) is an answer the page shows, not a fault to report.
    meta: { expectedStatuses: [404] },
    // Returning to the tab would ask for every loaded page again, one after another. A remount still does (an
    // account's states change by playing), and the guest's records are read again on focus (`useGuestRecords`).
    refetchOnWindowFocus: false,
  })
}
