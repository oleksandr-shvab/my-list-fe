import { Link, useMatchRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { House, LogOut, User } from 'lucide-react'

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
import { useLogoutMutation } from '@/features/auth/mutations'
import { useAuthStore } from '@/features/auth/store'

const navItems = [
  { to: '/', labelKey: 'nav.home', icon: House, exact: true },
] as const

export function AppSidebar() {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()
  const { isMobile, setOpenMobile } = useSidebar()
  const email = useAuthStore((state) => state.user?.email)
  const logout = useLogoutMutation()

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
        <SidebarMenu className="gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip={t('nav.profile')}
              isActive={!!matchRoute({ to: '/profile', fuzzy: true })}
            >
              <Link to="/profile" onClick={closeMobileSidebar}>
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                  <User />
                </span>
                <span className="grid flex-1 leading-tight">
                  <span className="truncate font-medium">
                    {t('nav.profile')}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {email}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t('nav.log_out')}
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut />
              <span>
                {logout.isPending ? t('nav.logging_out') : t('nav.log_out')}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
