import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import { PhoneHeader } from '@/components/phone-header'
import { MAIN_ID, SkipLink } from '@/components/skip-link'
import { SIDEBAR_COOKIE_NAME, SidebarProvider } from '@/components/ui/sidebar'
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
        <SkipLink />
        <AppSidebar />
        {/* `min-w-0` lets long content shrink instead of scrolling the page sideways. */}
        <div className="relative flex w-full min-w-0 flex-1 flex-col bg-background">
          <PhoneHeader />
          <main
            id={MAIN_ID}
            tabIndex={-1}
            className="flex min-w-0 flex-1 flex-col p-6 focus-visible:outline-none"
          >
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
