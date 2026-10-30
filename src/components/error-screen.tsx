import { Link, useRouter } from '@tanstack/react-router'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'

export function ErrorScreen({ error }: { error: Error }) {
  const { t } = useTranslation()
  const router = useRouter()
  const apiError = error instanceof ApiError ? error : null

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center">
      <p className="text-sm text-muted-foreground">
        {apiError?.isNetworkError
          ? t('error_screen.network')
          : t('error_screen.generic')}
      </p>
      {apiError?.requestId && (
        <p className="text-xs text-muted-foreground">
          {t('error_screen.reference', { id: apiError.requestId })}
        </p>
      )}
      <Button type="button" onClick={() => router.invalidate()}>
        {t('error_screen.try_again')}
      </Button>
    </div>
  )
}

// The screen for a page that does not exist. The router renders it with props of its own, so it
// takes none; `NotFoundMessage` is the one with texts that can be replaced.
export function NotFoundScreen() {
  return <NotFoundMessage />
}

// A "not found" page with its own texts, so a game page can say "Unknown game" in the same layout.
export function NotFoundMessage({
  titleKey = 'error_screen.not_found_title',
  textKey = 'error_screen.not_found_text',
}: {
  titleKey?: ParseKeys
  textKey?: ParseKeys
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center">
      <h1 className="text-2xl font-medium">{t(titleKey)}</h1>
      <p className="text-sm text-muted-foreground">{t(textKey)}</p>
      <Button asChild>
        <Link to="/">{t('error_screen.go_home')}</Link>
      </Button>
    </div>
  )
}
