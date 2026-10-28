import { Link, useLocation, useMatchRoute } from '@tanstack/react-router'
import { LogIn, LogOut, RotateCw, User, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useLogoutMutation } from '../mutations'
import { useSession } from '../session'

type AccountAreaProps = {
  // Called when a link is followed, so the phone sidebar can close behind it.
  onNavigate?: () => void
}

// The bottom of the sidebar: what the visitor can do about their account. One component
// per session state; the state itself is derived from the `/auth/me` query.
export function AccountArea({ onNavigate }: AccountAreaProps) {
  const { status, user, retry } = useSession()

  return (
    <SidebarMenu className="gap-2">
      {status === 'pending' && <AccountPlaceholder />}
      {status === 'error' && <AccountCheckFailed onRetry={retry} />}
      {status === 'guest' && <GuestActions onNavigate={onNavigate} />}
      {status === 'signed_in' && (
        <SignedInActions email={user?.email} onNavigate={onNavigate} />
      )}
    </SidebarMenu>
  )
}

// Same size as the guest buttons, so the area does not jump when the answer arrives.
function AccountPlaceholder() {
  return (
    <>
      <SidebarMenuItem aria-hidden>
        <Skeleton className="h-8 w-full" />
      </SidebarMenuItem>
      <SidebarMenuItem aria-hidden>
        <Skeleton className="h-8 w-full" />
      </SidebarMenuItem>
    </>
  )
}

function AccountCheckFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()

  return (
    <SidebarMenuItem>
      <p className="px-2 pb-1 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:sr-only">
        {t('nav.account_check_failed')}
      </p>
      <SidebarMenuButton tooltip={t('nav.retry')} onClick={onRetry}>
        <RotateCw />
        <span>{t('nav.retry')}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function GuestActions({ onNavigate }: AccountAreaProps) {
  const { t } = useTranslation()
  // Both links carry the current page, so login or sign-up brings the visitor back to it.
  const href = useLocation({ select: (location) => location.href })

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={t('nav.log_in')}>
          <Link to="/login" search={{ redirect: href }} onClick={onNavigate}>
            <LogIn />
            <span>{t('nav.log_in')}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={t('nav.sign_up')}>
          <Link to="/register" search={{ redirect: href }} onClick={onNavigate}>
            <UserPlus />
            <span>{t('nav.sign_up')}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )
}

function SignedInActions({
  email,
  onNavigate,
}: AccountAreaProps & { email: string | undefined }) {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()
  const logout = useLogoutMutation()

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          asChild
          tooltip={t('nav.profile')}
          isActive={!!matchRoute({ to: '/profile', fuzzy: true })}
        >
          <Link to="/profile" onClick={onNavigate}>
            <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
              <User />
            </span>
            <span className="grid flex-1 leading-tight">
              <span className="truncate font-medium">{t('nav.profile')}</span>
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
    </>
  )
}
