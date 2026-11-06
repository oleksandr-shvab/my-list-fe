import { hashKey, type QueryClient } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'
import type { AxiosResponse } from 'axios'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { apiClient, apiPathOf, ApiError } from '@/lib/api-client'
import { reportError } from '@/lib/report-error'
import { meQueryOptions } from './queries'
import {
  getSessionEpoch,
  getSignedInUser,
  isLogoutRunning,
  isOnAccountOnlyPage,
  signOutLocally,
  startNewSessionEpoch,
} from './session'

// Only a top-level `signed_in: false` counts, and only on a game route; the cheap body check goes
// first. A missing or null field, a nested one, a string, an array or a Blob say nothing.
function isGuestGameAnswer(response: AxiosResponse): boolean {
  const { data } = response
  if (typeof data !== 'object' || data === null) return false
  if ((data as { signed_in?: unknown }).signed_in !== false) return false
  return apiPathOf(response.config)?.startsWith('/v1/games/') === true
}

// Signs out locally on a 401 or a game response with `signed_in: false`, but only for a request
// sent in the current session (see CLAUDE.md). Returns one function that removes all of it.
export function installSessionGuard({
  queryClient,
  router,
}: {
  queryClient: QueryClient
  router: AnyRouter
}): () => void {
  // A different identity in the `me` data is a new session: it starts a new epoch.
  const meHash = hashKey(meQueryOptions().queryKey)
  let identity = getSignedInUser(queryClient)?.id
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryHash !== meHash) return
    const next = getSignedInUser(queryClient)?.id
    if (next === identity) return
    identity = next
    startNewSessionEpoch()
  })

  // Only while the app shows a signed-in user. A failed login is a 401 too, but then nobody is
  // signed in, and a second 401 right after the first finds the guest state already set.
  function endSession(sentIn: number | undefined) {
    if (sentIn !== getSessionEpoch() || isLogoutRunning()) return
    if (!getSignedInUser(queryClient)) return
    signOutLocally(queryClient)
    // On a public page the user stays and the account area shows the guest state. On an
    // account page the guard runs again and sends them to login with this page as `redirect`.
    if (isOnAccountOnlyPage(router)) {
      toast.info(i18n.t('auth.session_expired'))
      void router.invalidate()
    }
  }

  // This runs inside the response chain: a failure here must not turn a good answer into an
  // error, or replace the original rejection.
  function safely(work: () => void) {
    try {
      work()
    } catch (error) {
      reportError(error, 'session guard')
    }
  }

  // Synchronous, so the stamp is taken in the call that sends the request.
  const requestId = apiClient.interceptors.request.use(
    (config) => {
      config.sessionEpoch = getSessionEpoch()
      return config
    },
    undefined,
    { synchronous: true },
  )

  const responseId = apiClient.interceptors.response.use(
    (response) => {
      safely(() => {
        if (isGuestGameAnswer(response))
          endSession(response.config.sessionEpoch)
      })
      return response
    },
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        safely(() => endSession(error.sentInEpoch))
      }
      return Promise.reject(error)
    },
  )

  return () => {
    unsubscribe()
    apiClient.interceptors.request.eject(requestId)
    apiClient.interceptors.response.eject(responseId)
  }
}
