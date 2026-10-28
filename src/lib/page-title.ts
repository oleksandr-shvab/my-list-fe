import { useMatches } from '@tanstack/react-router'
import type { ParseKeys } from 'i18next'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

type TitleKey = ParseKeys

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    // Catalogue key of the page name shown in the browser tab, e.g. 'profile.title'.
    // Keys only, so a URL value (like a reset token) can never reach the title.
    pageTitle?: TitleKey
  }
}

type TitleMatch = {
  status: string
  staticData: { pageTitle?: TitleKey }
}

// The deepest match that names a page wins; any "not found" match overrides it.
export function resolvePageTitleKey(
  matches: readonly TitleMatch[],
): TitleKey | undefined {
  if (matches.some((match) => match.status === 'notFound')) {
    return 'error_screen.not_found_title'
  }
  return matches.findLast((match) => match.staticData.pageTitle)?.staticData
    .pageTitle
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
