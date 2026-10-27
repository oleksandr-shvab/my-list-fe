import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ApiError } from '@/lib/api-client'
import { Toaster } from '@/components/ui/sonner'
import { meQueryOptions } from '@/features/auth/queries'
import { useAuthStore } from '@/features/auth/store'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.query(meQueryOptions())
      useAuthStore.getState().setUser(user)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        useAuthStore.getState().clearUser()
        return
      }
      // Not a confirmed 401 — don't guess at auth state, surface it instead.
      throw error
    }
  },
  pendingComponent: RootPending,
  component: RootComponent,
})

function RootPending() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  )
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}
