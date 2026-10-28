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
    // Start the sign-in check, but do not wait for it: public pages show before it answers.
    // Pages that need the answer wait for it themselves, and a failure shows up there.
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
