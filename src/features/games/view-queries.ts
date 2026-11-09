import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { gamesGetPuzzle, gamesGetTodayPuzzle } from '@/api/generated/api'
import type { GameGuesserView } from '@/api/generated/models'
import { refreshSession } from '@/features/auth/session'

// Whose game the page shows: a user id, `'guest'`, or `'unconfirmed'` when the session check failed.
// Trust a view's own `signed_in`, not its key: `'guest'` can briefly hold an account's view after a login in another tab.
export type Viewer = string

export const GUEST_VIEWER: Viewer = 'guest'
export const UNCONFIRMED_VIEWER: Viewer = 'unconfirmed'

export function isAccountViewer(viewer: Viewer): boolean {
  return viewer !== GUEST_VIEWER && viewer !== UNCONFIRMED_VIEWER
}

type GameViewTarget = { slug: string; date: string; viewer: Viewer }

// One key per puzzle day and viewer, whichever address opened it: `/` and `/games/{slug}/{date}` show one view.
export function gameViewKey({ slug, date, viewer }: GameViewTarget) {
  return ['game-view', slug, date, viewer] as const
}

// The key an answer is written to: the one the page reads. `signed_in: false` is a guest's, and an account's view
// is never written under `'guest'` (null).
export function viewerOfView(
  view: GameGuesserView,
  viewer: Viewer,
): Viewer | null {
  if (!view.signed_in) {
    return viewer === UNCONFIRMED_VIEWER ? viewer : GUEST_VIEWER
  }
  return viewer === GUEST_VIEWER ? null : viewer
}

// The server knows a user the page does not: treat it as a sign-in and ask who it is.
export function checkSessionOfView(
  view: GameGuesserView,
  viewer: Viewer,
  client: QueryClient,
) {
  if (view.signed_in && !isAccountViewer(viewer)) void refreshSession(client)
}

// The puzzle of a known day. Every later fetch of a page goes through this, so an open page keeps its day.
export function gameViewQueryOptions(target: GameViewTarget, enabled: boolean) {
  const { slug, date, viewer } = target
  return queryOptions({
    queryKey: gameViewKey(target),
    queryFn: async ({ signal, client }) => {
      const view = await gamesGetPuzzle(slug, date, undefined, { signal })
      checkSessionOfView(view, viewer, client)
      return view
    },
    enabled,
    // The screen refreshes only on purpose: a guess writes its answer in, and a failed account guess asks again.
    staleTime: Infinity,
  })
}

// What is today's puzzle? Asked by a page with no date; the answer is written under its day's key and the screen
// pins that day. `opening` is one id per screen shown, so a page opened again asks again.
export function todayViewQueryOptions(
  { slug, viewer, opening }: { slug: string; viewer: Viewer; opening: string },
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['game-today', slug, viewer, opening] as const,
    queryFn: async ({ signal, client }) => {
      const view = await gamesGetTodayPuzzle(slug, undefined, { signal })
      checkSessionOfView(view, viewer, client)
      client.setQueryData(
        gameViewKey({
          slug,
          date: view.date,
          viewer: viewerOfView(view, viewer) ?? viewer,
        }),
        view,
      )
      return view
    },
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
