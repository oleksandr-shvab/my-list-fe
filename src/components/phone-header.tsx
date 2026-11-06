import { useEffect, useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { BrandLink } from '@/components/brand-link'
import { MAIN_ID } from '@/components/skip-link'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { AccountArea } from '@/features/auth/components/account-area'

// The page banner on phones (AC-35, AC-37), so it sits outside `main`.
export function PhoneHeader({
  linkFollowedRef,
}: {
  // Set by the panel's links just before they close it; read here once the panel has closed.
  linkFollowedRef: RefObject<boolean>
}) {
  const { t } = useTranslation()
  const { isMobile, openMobile } = useSidebar()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // The panel is a dialog opened by a plain button, so Radix has no trigger to return focus to (AC-66).
  // A followed link changed the page, so focus goes to the page, as after the skip link.
  useEffect(() => {
    if (wasOpen.current && !openMobile) {
      if (linkFollowedRef.current) document.getElementById(MAIN_ID)?.focus()
      else toggleRef.current?.focus()
      linkFollowedRef.current = false
    }
    wasOpen.current = openMobile
  }, [openMobile, linkFollowedRef])

  // Same 768 px breakpoint as the sidebar's own switch to a panel.
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
