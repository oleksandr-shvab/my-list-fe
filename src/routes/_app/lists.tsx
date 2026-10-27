import { useTranslation } from 'react-i18next'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/lists')({
  component: ListsPage,
})

function ListsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col gap-1">
      <h1 className="text-2xl font-medium">{t('lists.title')}</h1>
      <p className="text-muted-foreground">{t('lists.empty')}</p>
    </div>
  )
}
