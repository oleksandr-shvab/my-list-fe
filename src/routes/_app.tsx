import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    if (useAuthStore.getState().status !== 'authenticated') {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

// SidebarProvider persists its state to a cookie for SSR to read back; there is
// no server render here, so read it ourselves to avoid a flash of open sidebar.
function getStoredSidebarOpen() {
  return !document.cookie
    .split('; ')
    .some((entry) => entry === 'sidebar_state=false')
}

function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={getStoredSidebarOpen()}>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ms-1.5" />
          </header>
          <div className="flex flex-1 flex-col p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
