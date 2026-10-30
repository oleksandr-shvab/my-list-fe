import { Link } from '@tanstack/react-router'
import { Archive, Gamepad2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { BrandLink } from '@/components/brand-link'
import { LanguageSwitcher } from '@/components/language-switcher'
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { AccountArea } from '@/features/auth/components/account-area'
import { getDefaultGame, getGamesInOrder } from '@/features/games/registry'
import type { GameEntry } from '@/features/games/types'
import { useCurrentGame } from '@/features/games/use-current-game'

export function AppSidebar() {
  const { t } = useTranslation()
  const { isMobile, setOpenMobile } = useSidebar()
  const { game: currentGame, archiveOpen } = useCurrentGame()
  const toggleLabel = t('nav.toggle_sidebar')

  // The mobile sidebar is an overlay — navigating behind it would leave it open.
  function closeMobileSidebar() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar
      collapsible="icon"
      mobileTitle={t('nav.sidebar_title')}
      mobileDescription={t('nav.sidebar_description')}
    >
      <SidebarHeader>
        <SidebarMenuButton size="lg" asChild className="w-auto">
          <BrandLink onClick={closeMobileSidebar} />
        </SidebarMenuButton>
      </SidebarHeader>

      <nav aria-label={t('nav.games')} className="flex min-h-0 flex-1 flex-col">
        {/* The vendored class hides overflow in icon mode; the entries must still scroll there. */}
        <SidebarContent className="group-data-[collapsible=icon]:overflow-auto">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {getGamesInOrder().map((game) => (
                  <GameNavItem
                    key={game.slug}
                    game={game}
                    isCurrent={currentGame?.slug === game.slug && !archiveOpen}
                    onNavigate={closeMobileSidebar}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarGroup className="pt-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={t('games.archive_title')}
                isActive={archiveOpen}
                className="max-md:h-11"
              >
                <Link
                  to="/games/$slug/archive"
                  params={{ slug: (currentGame ?? getDefaultGame()).slug }}
                  onClick={closeMobileSidebar}
                >
                  <Archive />
                  <span>{t('games.archive_title')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </nav>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <LanguageSwitcher className="max-md:[&_button]:h-11 max-md:[&_button]:min-w-11 group-data-[collapsible=icon]:flex-col" />
          <ThemeToggle className="shrink-0 max-md:size-11" />
        </div>
        <AccountArea onNavigate={closeMobileSidebar} />
        {/* On a phone the header holds the toggle; here it is the keyboard way to collapse. */}
        {!isMobile && (
          <SidebarTrigger aria-label={toggleLabel} className="self-start" />
        )}
      </SidebarFooter>

      <SidebarRail aria-label={toggleLabel} title={toggleLabel} />
    </Sidebar>
  )
}

type GameNavItemProps = {
  game: GameEntry
  // This entry is the game being shown, and its archive is not open (AC-30).
  isCurrent: boolean
  onNavigate: () => void
}

function GameNavItem({ game, isCurrent, onNavigate }: GameNavItemProps) {
  const { t } = useTranslation()
  const itemRef = useRef<HTMLLIElement>(null)
  const name = t(game.nameKey)

  // A long list scrolls inside the sidebar, so bring the current entry into view.
  useEffect(() => {
    if (isCurrent) itemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isCurrent])

  return (
    <SidebarMenuItem ref={itemRef}>
      <SidebarMenuButton
        asChild
        tooltip={name}
        isActive={isCurrent}
        className="max-md:h-11"
      >
        {/* Exact matching keeps the router from marking the entry on the archive page. It does
            not match `/` or a dated page, so those get the attribute from us. */}
        <Link
          to="/games/$slug"
          params={{ slug: game.slug }}
          activeOptions={{ exact: true }}
          aria-current={isCurrent ? 'page' : undefined}
          onClick={onNavigate}
        >
          <Gamepad2 />
          <span>{name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
