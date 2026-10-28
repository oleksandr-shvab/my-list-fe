import { LanguageSwitcher } from '@/components/language-switcher'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import {
  SIDEBAR_COOKIE_NAME,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

// SidebarProvider persists its state to a cookie for SSR to read back; there is
// no server render here, so read it ourselves to avoid a flash of open sidebar.
function getStoredSidebarOpen() {
  return !document.cookie
    .split('; ')
    .some((entry) => entry === `${SIDEBAR_COOKIE_NAME}=false`)
}

function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={getStoredSidebarOpen()}>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ms-1.5" />
            <LanguageSwitcher className="ms-auto" />
          </header>
          <div className="flex flex-1 flex-col p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
