import { Link, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'

export function ErrorScreen({ error }: { error: Error }) {
  const { t } = useTranslation()
  const router = useRouter()
  const apiError = error instanceof ApiError ? error : null

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
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

export function NotFoundScreen() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-medium">
        {t('error_screen.not_found_title')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('error_screen.not_found_text')}
      </p>
      <Button asChild>
        <Link to="/">{t('error_screen.go_home')}</Link>
      </Button>
    </div>
  )
}
