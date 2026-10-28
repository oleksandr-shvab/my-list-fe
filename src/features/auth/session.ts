import { hashKey, useQuery, type QueryClient } from '@tanstack/react-query'
import { redirect, type AnyRouter } from '@tanstack/react-router'
import { meQueryOptions } from './queries'
import type { User } from './types'

// The signed-in state lives in one place: the `/auth/me` query. Its data is the user, or null
// for a guest (a 401). An error means the answer is unknown (network failure, 5xx). Nothing here
// copies that into other state, so a cached answer can never disagree with what is shown.

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    // Marks a page that needs an account. A 401 on it sends the user to the login page.
    accountOnly?: boolean
  }
}

export type SessionStatus = 'pending' | 'signed_in' | 'guest' | 'error'

type MeQueryState = {
  data: User | null | undefined
  isFetching: boolean
  isError: boolean
}

export function getSessionStatus({
  data,
  isFetching,
  isError,
}: MeQueryState): SessionStatus {
  if (data) return 'signed_in'
  if (data === null) return 'guest'
  // A retry after a failure is pending again, not still failed.
  return isError && !isFetching ? 'error' : 'pending'
}

export function useSession() {
  const query = useQuery(meQueryOptions())
  const status = getSessionStatus(query)

  return {
    status,
    user: query.data ?? undefined,
    error: status === 'error' ? query.error : null,
    retry: () => void query.refetch(),
  }
}

// For route guards: the cached answer, or one request. Throws when the answer is unknown.
export function ensureSession(queryClient: QueryClient): Promise<User | null> {
  return queryClient.query(meQueryOptions())
}

// For the sign-in pages: a signed-in user goes home. When the check fails the page shows anyway,
// because a signed-out visitor must be able to log in while the check is down.
export async function redirectIfSignedIn(queryClient: QueryClient) {
  const user = await ensureSession(queryClient).catch(() => null)
  if (user) throw redirect({ to: '/' })
}

export function getSignedInUser(queryClient: QueryClient): User | undefined {
  return queryClient.getQueryData(meQueryOptions().queryKey) ?? undefined
}

// Sets the answer to "guest" and drops every other cached query (they belong to the old user).
// `me` is set to null instead of removed: a mounted `useQuery` keeps reading a removed query
// object, and would go on showing the old user.
export function signOutLocally(queryClient: QueryClient) {
  const meKey = meQueryOptions().queryKey
  const meHash = hashKey(meKey)
  queryClient.setQueryData(meKey, null)
  queryClient.removeQueries({
    predicate: (query) => query.queryHash !== meHash,
  })
}

export function isOnAccountOnlyPage(router: AnyRouter): boolean {
  return router.state.matches.some((match) => match.staticData.accountOnly)
}

// The user logged out: forget everything, and leave the page only when it is for accounts.
export async function finishLogout(
  queryClient: QueryClient,
  router: AnyRouter,
) {
  signOutLocally(queryClient)
  if (isOnAccountOnlyPage(router)) await router.navigate({ to: '/' })
}

// The backend ends every session of the reset account, so do not wait for `/auth/me` to say 401.
export async function finishPasswordReset(
  queryClient: QueryClient,
  router: AnyRouter,
) {
  signOutLocally(queryClient)
  await router.navigate({ to: '/login' })
}
