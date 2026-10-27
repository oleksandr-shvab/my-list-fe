import { useTranslation } from 'react-i18next'
import { createFileRoute } from '@tanstack/react-router'
import { ListChecks, Sparkles, UserRound } from 'lucide-react'

import { QuickActionCard } from '@/components/quick-action-card'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

function HomePage() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-2xl font-medium">
          {user
            ? t('home.welcome_named', { email: user.email })
            : t('home.welcome')}
        </h1>
        <p className="text-muted-foreground">{t('home.intro')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionCard
          to="/lists"
          icon={ListChecks}
          title={t('home.lists_title')}
          description={t('home.lists_description')}
          style={{ animationDelay: '75ms' }}
        />
        <QuickActionCard
          to="/profile"
          icon={UserRound}
          title={t('home.profile_title')}
          description={t('home.profile_description')}
          style={{ animationDelay: '150ms' }}
        />
        <QuickActionCard
          to="/lists"
          icon={Sparkles}
          title={t('home.new_title')}
          description={t('home.new_description')}
          style={{ animationDelay: '225ms' }}
        />
      </div>
    </div>
  )
}
