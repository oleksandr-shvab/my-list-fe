import { useTranslation } from 'react-i18next'
import { createFileRoute } from '@tanstack/react-router'

import { ThemeToggle } from '@/components/theme-toggle'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { UpdatePasswordForm } from '@/features/auth/components/update-password-form'
import { useSession } from '@/features/auth/session'

export const Route = createFileRoute('/_app/_account/profile')({
  staticData: { pageTitle: 'profile.title' },
  component: ProfilePage,
})

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user } = useSession()

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-medium">{t('profile.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.account')}</CardTitle>
          <CardDescription>{t('profile.account_description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Row label={t('profile.email')}>
            <span className="truncate text-sm">{user?.email}</span>
          </Row>
          <Separator />
          <Row label={t('profile.member_since')}>
            <span className="text-sm">
              {user
                ? new Date(user.created_at).toLocaleDateString(i18n.language, {
                    dateStyle: 'medium',
                  })
                : '—'}
            </span>
          </Row>
          <Separator />
          <Row label={t('theme.label')}>
            <ThemeToggle />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.password')}</CardTitle>
          <CardDescription>{t('profile.password_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
