import { useTranslation } from 'react-i18next'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
  staticData: { pageTitle: 'app.tagline' },
  component: HomePage,
})

// A neutral placeholder until the game screen replaces it.
function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col gap-1">
      <h1 className="text-2xl font-medium">{t('app.name')}</h1>
      <p className="text-muted-foreground">{t('app.tagline')}</p>
    </div>
  )
}
