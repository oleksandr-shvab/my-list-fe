import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { meQueryOptions } from '@/features/auth/queries'
import { useAuthStore } from '@/features/auth/store'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.ensureQueryData(meQueryOptions())
      useAuthStore.getState().setUser(user)
    } catch {
      useAuthStore.getState().clearUser()
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
  return <Outlet />
}
