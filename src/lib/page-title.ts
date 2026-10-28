import { useMatches } from '@tanstack/react-router'
import type { ParseKeys } from 'i18next'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { findGame, getDefaultGame } from '@/features/games/registry'

type TitleKey = ParseKeys

// Marks a page whose name is the name of the game it shows: the game of the `slug` in the
// address, or the default game on the home page.
export const GAME_NAME_TITLE = 'game-name'
type PageTitle = TitleKey | typeof GAME_NAME_TITLE

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    // Catalogue key of the page name shown in the browser tab, e.g. 'profile.title'.
    // Keys only, so a URL value (like a reset token) can never reach the title.
    pageTitle?: PageTitle
  }
}

type TitleMatch = {
  status: string
  params: Record<string, string>
  staticData: { pageTitle?: PageTitle }
}

function keyOfPage(match: TitleMatch): TitleKey | undefined {
  const { pageTitle } = match.staticData
  if (pageTitle !== GAME_NAME_TITLE) return pageTitle

  const { slug } = match.params
  const game = slug === undefined ? getDefaultGame() : findGame(slug)
  return game?.nameKey
}

// The deepest match that names a page wins; any "not found" match overrides it.
export function resolvePageTitleKey(
  matches: readonly TitleMatch[],
): TitleKey | undefined {
  if (matches.some((match) => match.status === 'notFound')) {
    return 'error_screen.not_found_title'
  }
  const page = matches.findLast((match) => match.staticData.pageTitle)
  return page && keyOfPage(page)
}

export function formatPageTitle(pageName: string | undefined, appName: string) {
  return pageName ? `${pageName} | ${appName}` : appName
}

// Keeps the browser tab title in step with the current page and language.
export function useDocumentTitle() {
  const { t } = useTranslation()
  const key = useMatches({ select: resolvePageTitleKey })

  // `t` is a new function whenever the language changes, so this reruns then too.
  useEffect(() => {
    document.title = formatPageTitle(key ? t(key) : undefined, t('app.name'))
  }, [key, t])
}
