import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'
import { useTranslation } from 'react-i18next'
import { AuthPage } from '@/features/auth/components/auth-page'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/reset-password')({
  staticData: { pageTitle: 'auth.reset.title' },
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  beforeLoad: () => {
    if (useAuthStore.getState().status === 'authenticated') {
      throw redirect({ to: '/' })
    }
  },
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { t } = useTranslation()
  const { token } = Route.useSearch()

  return (
    <AuthPage>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{t('auth.reset.invalid_title')}</CardTitle>
            <CardDescription>
              {t('auth.reset.invalid_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <Link
              to="/forgot-password"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t('auth.reset.request_new')}
            </Link>
          </CardContent>
        </Card>
      )}
    </AuthPage>
  )
}
