import { Link, useLocation } from '@tanstack/react-router'
import { LogIn, LogOut, RotateCw, User, UserPlus } from 'lucide-react'
import {
  useEffect,
  useRef,
  type MouseEvent,
  type Ref,
  type SyntheticEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { MAIN_ID } from '@/components/skip-link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { isPlainClick } from '@/lib/plain-click'
import { useLogoutMutation } from '../mutations'
import { useSession, type SessionStatus } from '../session'

type AccountAreaProps = {
  variant?: 'sidebar' | 'compact'
  onNavigate?: (event: MouseEvent) => void
}

export function AccountArea({
  variant = 'sidebar',
  onNavigate,
}: AccountAreaProps) {
  return variant === 'compact' ? (
    <CompactAccount />
  ) : (
    <SidebarAccount onNavigate={onNavigate} />
  )
}

function SidebarAccount({ onNavigate }: Pick<AccountAreaProps, 'onNavigate'>) {
  const { status, user, retry } = useSession()
  const { logout, logInRef } = useLogout(status)

  return (
    <SidebarMenu className="gap-2">
      {status === 'pending' && <AccountPlaceholder />}
      {status === 'error' && <AccountCheckFailed onRetry={retry} />}
      {status === 'guest' && (
        <GuestActions onNavigate={onNavigate} logInRef={logInRef} />
      )}
      {status === 'signed_in' && user && (
        <SidebarMenuItem>
          <AccountMenu
            email={user.email}
            logout={logout}
            onNavigate={onNavigate}
          />
        </SidebarMenuItem>
      )}
    </SidebarMenu>
  )
}

// Same size as the guest buttons, so the area does not jump when the answer arrives.
function AccountPlaceholder() {
  return (
    <>
      <SidebarMenuItem aria-hidden>
        <Skeleton className="h-8 w-full max-md:h-11" />
      </SidebarMenuItem>
      <SidebarMenuItem aria-hidden>
        <Skeleton className="h-8 w-full max-md:h-11" />
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
      <SidebarMenuButton
        tooltip={t('nav.retry')}
        onClick={onRetry}
        className="max-md:h-11"
      >
        <RotateCw />
        <span>{t('nav.retry')}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function useCurrentHref() {
  return useLocation({ select: (location) => location.href })
}

type GuestActionsProps = Pick<AccountAreaProps, 'onNavigate'> & {
  logInRef: Ref<HTMLAnchorElement>
}

function GuestActions({ onNavigate, logInRef }: GuestActionsProps) {
  const { t } = useTranslation()
  const href = useCurrentHref()

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={t('nav.log_in')}
          className="max-md:h-11"
        >
          <Link
            ref={logInRef}
            to="/login"
            search={{ redirect: href }}
            onClick={onNavigate}
          >
            <LogIn />
            <span>{t('nav.log_in')}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={t('nav.sign_up')}
          className="max-md:h-11"
        >
          <Link to="/register" search={{ redirect: href }} onClick={onNavigate}>
            <UserPlus />
            <span>{t('nav.sign_up')}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )
}

function CompactAccount() {
  const { t } = useTranslation()
  const { status, user, retry } = useSession()
  const { logout, logInRef } = useLogout(status)

  if (status === 'pending') {
    return <Skeleton aria-hidden className="h-11 w-20 shrink-0" />
  }
  if (status === 'error') {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0"
        title={t('nav.account_check_failed')}
        onClick={retry}
      >
        <RotateCw />
        {t('nav.retry')}
      </Button>
    )
  }
  if (status === 'signed_in' && user)
    return <AccountMenu compact email={user.email} logout={logout} />
  return <CompactGuest logInRef={logInRef} />
}

function CompactGuest({ logInRef }: { logInRef: Ref<HTMLAnchorElement> }) {
  const { t } = useTranslation()
  const href = useCurrentHref()

  return (
    <Button asChild variant="outline" className="h-11 shrink-0">
      <Link ref={logInRef} to="/login" search={{ redirect: href }}>
        <LogIn />
        {t('nav.log_in')}
      </Link>
    </Button>
  )
}

type Logout = { start: () => void; isPending: boolean }

// The logout lives here, not in the menu: the menu goes when the visitor becomes a guest, and
// takes the focus with it. Once "Log in" has taken its place, the focus goes there, unless the
// visitor moved it somewhere else while the request ran.
function useLogout(status: SessionStatus) {
  const mutation = useLogoutMutation()
  const logInRef = useRef<HTMLAnchorElement>(null)
  const loggedOut = status === 'guest' && !mutation.isIdle

  useEffect(() => {
    if (!loggedOut) return
    const focused = document.activeElement
    const focusIsLost =
      !focused ||
      focused === document.body ||
      focused.getAttribute('role') === 'dialog'
    if (focusIsLost) logInRef.current?.focus()
  }, [loggedOut])

  const logout: Logout = {
    start: () => mutation.mutate(),
    isPending: mutation.isPending,
  }
  return { logout, logInRef }
}

type AccountMenuProps = {
  email: string
  logout: Logout
  compact?: boolean
  onNavigate?: (event: MouseEvent) => void
}

function AccountMenu({
  email,
  logout,
  compact = false,
  onNavigate,
}: AccountMenuProps) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const panelIsClosing = useRef(false)
  const label = logout.isPending
    ? t('nav.logging_out')
    : t('nav.account_menu', { email })
  const initial = Array.from(email)[0]?.toUpperCase()
  // Not `disabled`: a disabled button that has the focus drops it to the page and the new name would not be read out.
  const pending = logout.isPending ? true : undefined
  const ignoreWhilePending = (event: SyntheticEvent) => {
    if (logout.isPending) event.preventDefault()
  }

  const avatar = (
    <span
      aria-hidden
      className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium text-foreground"
    >
      {initial}
    </span>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        onPointerDown={ignoreWhilePending}
        onKeyDown={ignoreWhilePending}
      >
        {compact ? (
          <Button
            type="button"
            variant="ghost"
            className="size-11 shrink-0 p-0 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-label={label}
            aria-busy={logout.isPending}
            aria-disabled={pending}
          >
            {avatar}
          </Button>
        ) : (
          <SidebarMenuButton
            size="lg"
            tooltip={label}
            aria-label={label}
            aria-busy={logout.isPending}
            aria-disabled={pending}
          >
            {avatar}
            <span className="min-w-0 flex-1 truncate">
              {logout.isPending ? t('nav.logging_out') : email}
            </span>
          </SidebarMenuButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={compact ? 'bottom' : isMobile ? 'top' : 'right'}
        align="end"
        className="min-w-48"
        // Radix returns focus to the button on close. In a panel that a followed link is closing, that pulls focus off the page,
        // and `PhoneHeader`'s move to `main` cannot prevent it because it runs while this menu still traps focus.
        onCloseAutoFocus={(event) => {
          if (!panelIsClosing.current) return
          panelIsClosing.current = false
          event.preventDefault()
          document.getElementById(MAIN_ID)?.focus()
        }}
      >
        <DropdownMenuItem asChild className="max-md:min-h-11">
          <Link
            to="/profile"
            onClick={(event) => {
              if (!isPlainClick(event)) return
              if (onNavigate && isMobile) panelIsClosing.current = true
              onNavigate?.(event)
            }}
          >
            <User />
            {t('nav.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="max-md:min-h-11" onSelect={logout.start}>
          <LogOut />
          {t('nav.log_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
