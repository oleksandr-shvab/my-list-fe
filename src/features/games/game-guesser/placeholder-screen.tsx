import { useTranslation } from 'react-i18next'
import { formatPuzzleDate } from '@/lib/utc-date'
import type { GameScreenProps } from '../types'

// The screen of the game guesser until Phase 2 replaces it. Default export, so the registry can
// load it with a plain `lazy(() => import(...))`.
export default function PlaceholderScreen({ date }: GameScreenProps) {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex flex-1 flex-col gap-1">
      <h1 className="text-2xl font-medium">{t('games.game_guesser.name')}</h1>
      <p>
        {t('games.puzzle_date', {
          date: formatPuzzleDate(date, i18n.language),
        })}
      </p>
      <p className="text-muted-foreground">{t('games.coming_soon')}</p>
    </div>
  )
}
