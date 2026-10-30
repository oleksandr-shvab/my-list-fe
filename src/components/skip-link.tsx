import { useTranslation } from 'react-i18next'

export const MAIN_ID = 'main'

// The first thing a keyboard user reaches. It shows only while focused, and moves the focus to
// the page's main area. It does not follow the `#main` link, so the address stays clean (AC-62).
export function SkipLink() {
  const { t } = useTranslation()

  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={(event) => {
        event.preventDefault()
        document.getElementById(MAIN_ID)?.focus()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
    >
      {t('nav.skip_to_content')}
    </a>
  )
}
