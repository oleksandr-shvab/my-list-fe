import type { QueryClient } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { apiClient, ApiError } from '@/lib/api-client'
import { getSignedInUser, isOnAccountOnlyPage, signOutLocally } from './session'

// `/auth/me` runs once per load, so this catches a session that ends later. Returns a function
// that removes the interceptor (tests install it once per router).
export function installSessionGuard({
  queryClient,
  router,
}: {
  queryClient: QueryClient
  router: AnyRouter
}): () => void {
  const id = apiClient.interceptors.response.use(
    undefined,
    (error: unknown) => {
      // Only while the app shows a signed-in user. A failed login is a 401 too, but then nobody is
      // signed in, and a second 401 right after the first finds the guest state already set.
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        getSignedInUser(queryClient)
      ) {
        signOutLocally(queryClient)
        // On a public page the user stays and the account area shows the guest state. On an
        // account page the guard runs again and sends them to login with this page as `redirect`.
        if (isOnAccountOnlyPage(router)) {
          toast.info(i18n.t('auth.session_expired'))
          void router.invalidate()
        }
      }
      return Promise.reject(error)
    },
  )

  return () => apiClient.interceptors.response.eject(id)
}
