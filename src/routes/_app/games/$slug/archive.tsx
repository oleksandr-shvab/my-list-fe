import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

// The real archive comes later; for now the page says so (AC-31). A static segment wins over
// `$date`, so this is never read as a date.
export const Route = createFileRoute('/_app/games/$slug/archive')({
  staticData: { pageTitle: 'games.archive_title' },
  component: ArchivePage,
})

function ArchivePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col gap-1">
      <h1 className="text-2xl font-medium">{t('games.archive_title')}</h1>
      <p className="text-muted-foreground">{t('games.archive_coming_soon')}</p>
    </div>
  )
}
