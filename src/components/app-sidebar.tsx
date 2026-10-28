import { Link, useMatchRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { House } from 'lucide-react'

import { BrandLink } from '@/components/brand-link'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { AccountArea } from '@/features/auth/components/account-area'

const navItems = [
  { to: '/', labelKey: 'nav.home', icon: House, exact: true },
] as const

export function AppSidebar() {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()
  const { isMobile, setOpenMobile } = useSidebar()

  // The mobile sidebar is an overlay — navigating behind it would leave it open.
  function closeMobileSidebar() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2">
          <SidebarMenuButton size="lg" asChild className="w-auto">
            <BrandLink onClick={closeMobileSidebar} />
          </SidebarMenuButton>
          <ThemeToggle className="shrink-0 group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={t(item.labelKey)}
                    isActive={!!matchRoute({ to: item.to, fuzzy: !item.exact })}
                  >
                    <Link to={item.to} onClick={closeMobileSidebar}>
                      <item.icon />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <AccountArea onNavigate={closeMobileSidebar} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
