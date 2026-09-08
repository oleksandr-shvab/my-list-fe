import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  useRouter,
} from '@tanstack/react-router'
import { ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
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
  errorComponent: RootError,
  component: RootComponent,
})

function RootPending() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  )
}

function RootError() {
  const router = useRouter()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t reach the server. Check your connection and try again.
      </p>
      <Button type="button" onClick={() => router.invalidate()}>
        Try again
      </Button>
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
