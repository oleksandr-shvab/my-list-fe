import { createFileRoute, redirect } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'
import { ensureSession } from '@/features/auth/session'

// The pages that need an account. This guard is a convenience: the backend answers 401 on
// account endpoints either way.
export const Route = createFileRoute('/_app/_account')({
  staticData: { accountOnly: true },
  beforeLoad: async ({ context, location }) => {
    // Waits for `/auth/me`. A network error or 5xx is not caught: the error screen shows
    // inside the layout with the request id, and "Try again" asks again.
    const user = await ensureSession(context.queryClient)
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  pendingComponent: PendingScreen,
})
