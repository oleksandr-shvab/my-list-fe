import { useEffect, useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { BrandLink } from '@/components/brand-link'
import { MAIN_ID } from '@/components/skip-link'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { AccountArea } from '@/features/auth/components/account-area'

// The slim one-row header below 768 px (AC-35): the sidebar button, the brand and the account
// control. It is the page banner there, so it sits outside `main`. It scrolls away when the
// screen is shorter than 500 px (AC-37). Wider screens do not render it at all.
export function PhoneHeader({
  linkFollowedRef,
}: {
  // Set by the panel's links just before they close it, and read here when the panel has closed.
  linkFollowedRef: RefObject<boolean>
}) {
  const { t } = useTranslation()
  const { isMobile, openMobile } = useSidebar()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // The panel is a dialog that a plain button opens, not a dialog trigger, so Radix has no
  // trigger to give the focus back to. Do it here when the panel closes (AC-66). Escape, a tap
  // outside and the close button give the focus back to the button. A followed link means the
  // page changed, so the focus goes to the page, as after the skip link.
  useEffect(() => {
    if (wasOpen.current && !openMobile) {
      if (linkFollowedRef.current) document.getElementById(MAIN_ID)?.focus()
      else toggleRef.current?.focus()
      linkFollowedRef.current = false
    }
    wasOpen.current = openMobile
  }, [openMobile, linkFollowedRef])

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
