import { Link, useRouter } from '@tanstack/react-router'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'

// By default "Try again" asks the router to load the page again. A screen that owns its own query passes `onRetry`.
export function ErrorScreen({
  error,
  onRetry,
}: {
  error: Error
  onRetry?: () => void
}) {
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
      <Button type="button" onClick={onRetry ?? (() => router.invalidate())}>
        {t('error_screen.try_again')}
      </Button>
    </div>
  )
}

// The router renders this with props of its own, so it takes none. `NotFoundMessage` takes custom texts.
export function NotFoundScreen() {
  return <NotFoundMessage />
}

export function NotFoundMessage({
  titleKey = 'error_screen.not_found_title',
  textKey = 'error_screen.not_found_text',
  showHomeLink = true,
}: {
  titleKey?: ParseKeys
  textKey?: ParseKeys
  showHomeLink?: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center">
      <h1 className="text-2xl font-medium">{t(titleKey)}</h1>
      <p className="text-sm text-muted-foreground">{t(textKey)}</p>
      {showHomeLink && (
        <Button asChild>
          <Link to="/">{t('error_screen.go_home')}</Link>
        </Button>
      )}
    </div>
  )
}
