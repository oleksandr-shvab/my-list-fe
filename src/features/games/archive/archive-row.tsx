import { Link } from '@tanstack/react-router'
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ArchiveItem } from '@/api/generated/models'
import { formatPuzzleDate } from '@/lib/utc-date'
import { cn } from '@/lib/utils'
import {
  boxesOf,
  stateText,
  type BoxMark,
  type RowState,
} from './archive-state'

const BOX_STYLES: Record<BoxMark, string> = {
  empty: 'border border-border',
  filled: 'bg-muted-foreground/40',
  correct: 'bg-green-700 text-white dark:bg-green-400 dark:text-black',
  failed: 'bg-red-700 text-white dark:bg-red-400 dark:text-black',
}

type ArchiveRowProps = {
  slug: string
  item: ArchiveItem
  rowState: RowState
}

// A link to the puzzle's day: the same screen, no full reload, and a new tab works (AC-83). The link's name is spelled
// out so the state is not read twice, once from the text and once from the boxes.
export function ArchiveRow({ slug, item, rowState }: ArchiveRowProps) {
  const { t, i18n } = useTranslation()
  const number = t('games.archive.number', { number: item.number })
  const date = formatPuzzleDate(item.date, i18n.language)
  const state = stateText(rowState, t)

  return (
    <Link
      to="/games/$slug/$date"
      params={{ slug, date: item.date }}
      aria-label={`${number}, ${date}, ${state}`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2 hover:bg-accent max-md:min-h-11"
    >
      <span className="flex items-baseline gap-2">
        <span className="font-medium tabular-nums">{number}</span>
        <span className="text-sm text-muted-foreground">{date}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="text-sm">{state}</span>
        {/* The same words as the state text (AC-85): the boxes are never the only carrier of the state. */}
        <span role="img" aria-label={state} className="flex gap-1">
          {boxesOf(rowState).map((mark, index) => (
            <span
              key={index}
              className={cn(
                'flex size-4 items-center justify-center rounded-sm',
                BOX_STYLES[mark],
              )}
            >
              {mark === 'correct' && <Check aria-hidden className="size-3" />}
              {mark === 'failed' && <X aria-hidden className="size-3" />}
            </span>
          ))}
        </span>
      </span>
    </Link>
  )
}
