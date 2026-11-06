import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { ensureSession } from '@/features/auth/session'
import { useDocumentTitle } from '@/lib/page-title'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ context }) => {
    // Start the sign-in check without waiting: public pages show before it answers, and pages that need it wait for it themselves.
    ensureSession(context.queryClient).catch(() => {})
  },
  component: RootComponent,
})

function RootComponent() {
  useDocumentTitle()

  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}
