import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { BrandLink } from '@/components/brand-link'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { AccountArea } from '@/features/auth/components/account-area'

// The slim one-row header below 768 px (AC-35): the sidebar button, the brand and the account
// control. It is the page banner there, so it sits outside `main`. It scrolls away when the
// screen is shorter than 500 px (AC-37). Wider screens do not render it at all.
export function PhoneHeader() {
  const { t } = useTranslation()
  const { isMobile, openMobile } = useSidebar()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // The panel is a dialog that a plain button opens, not a dialog trigger, so Radix has no
  // trigger to give the focus back to. Do it here when the panel closes (AC-66).
  useEffect(() => {
    if (wasOpen.current && !openMobile) toggleRef.current?.focus()
    wasOpen.current = openMobile
  }, [openMobile])

  // The same 768 px breakpoint as the sidebar's own switch to a panel, so the two always agree.
  if (!isMobile) return null

  return (
    <header className="top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-2 [@media(min-height:500px)]:sticky">
      <SidebarTrigger
        ref={toggleRef}
        aria-label={t('nav.toggle_sidebar')}
        className="size-11 shrink-0"
      />
      <BrandLink className="h-11 min-w-0 flex-1" />
      <AccountArea variant="compact" />
    </header>
  )
}
