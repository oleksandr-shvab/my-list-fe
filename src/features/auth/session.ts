import { hashKey, useQuery, type QueryClient } from '@tanstack/react-query'
import { redirect, type AnyRouter } from '@tanstack/react-router'
import { meQueryOptions } from './queries'
import type { User } from './types'

// The `/auth/me` query is the only signed-in state: the user, null for a guest (401), an error when unknown.
// Nothing copies it into other state, so a cached answer cannot disagree with what is shown.

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
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

export function ensureSession(queryClient: QueryClient): Promise<User | null> {
  return queryClient.query(meQueryOptions())
}

// For the sign-in pages: a signed-in user goes home. When the check fails the page shows anyway,
// because a signed-out visitor must be able to log in while the check is down.
export async function redirectIfSignedIn(queryClient: QueryClient) {
  const user = await ensureSession(queryClient).catch(() => null)
  if (user) throw redirect({ to: '/' })
}

// Counts the sessions this tab has shown; the session guard stamps each request with it.
let sessionEpoch = 0

export function getSessionEpoch(): number {
  return sessionEpoch
}

export function startNewSessionEpoch(): void {
  sessionEpoch += 1
}

// True while a logout runs, so a 401 arriving meanwhile is not taken for a session that ended on its own.
let logoutRunning = false

export function isLogoutRunning(): boolean {
  return logoutRunning
}

export function setLogoutRunning(running: boolean): void {
  logoutRunning = running
}

export function getSignedInUser(queryClient: QueryClient): User | undefined {
  return queryClient.getQueryData(meQueryOptions().queryKey) ?? undefined
}

// `me` is set to null, not removed: a mounted `useQuery` keeps reading a removed query and would go on
// showing the old user. A pending `/auth/me` request is cancelled first so it cannot write the old user back.
export function signOutLocally(queryClient: QueryClient) {
  const meKey = meQueryOptions().queryKey
  const meHash = hashKey(meKey)
  void queryClient.cancelQueries({ queryKey: meKey })
  queryClient.setQueryData(meKey, null)
  queryClient.removeQueries({
    predicate: (query) => query.queryHash !== meHash,
  })
}

export function isOnAccountOnlyPage(router: AnyRouter): boolean {
  return router.state.matches.some((match) => match.staticData.accountOnly)
}

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
