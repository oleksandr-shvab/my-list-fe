import { Check, Layers, SkipForward, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GuessRead, GuessResult } from '@/api/generated/models'
import { cn } from '@/lib/utils'
import { RESULT_KEYS } from './results'

// The icon and the word carry the result; the color only helps (AC-13, AC-111). Each color pair has at least 3:1
// against the page background in the light and the dark theme.
const RESULT_STYLES: Record<GuessResult, { icon: LucideIcon; color: string }> =
  {
    correct: {
      icon: Check,
      color: 'text-green-700 dark:text-green-400',
    },
    franchise: {
      icon: Layers,
      color: 'text-amber-700 dark:text-amber-400',
    },
    wrong: { icon: X, color: 'text-red-700 dark:text-red-400' },
    skipped: { icon: SkipForward, color: 'text-muted-foreground' },
  }

export function GuessList({ guesses }: { guesses: GuessRead[] }) {
  const { t } = useTranslation()

  if (guesses.length === 0) return null

  return (
    <ol aria-label={t('games.guesses_label')} className="flex flex-col gap-1">
      {guesses.map((guess, index) => {
        const { icon: Icon, color } = RESULT_STYLES[guess.result]
        return (
          // A guess can repeat only as a skip, and the list only grows: the position is its identity.
          <li
            key={index}
            className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
          >
            <Icon aria-hidden className={cn('size-4 shrink-0', color)} />
            <span className="min-w-0 flex-1 truncate">{guess.name}</span>
            <span className={cn('shrink-0 font-medium', color)}>
              {t(RESULT_KEYS[guess.result])}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
