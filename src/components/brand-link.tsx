import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

// The same letter as public/favicon.svg, drawn as a path so it needs no font.
function LetterMark() {
  return (
    <span
      aria-hidden
      className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
    >
      <svg viewBox="0 0 32 32" className="size-full" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M9.5 8H14.5A8 8 0 0 1 14.5 24H9.5ZM13 11.5H14.5A4.5 4.5 0 0 1 14.5 20.5H13Z"
        />
      </svg>
    </span>
  )
}

// The product name as a link to the home page. Extra props go to the link, so the
// sidebar can wrap it in a menu button with `asChild`.
export function BrandLink({
  className,
  ...delegated
}: Omit<React.ComponentProps<'a'>, 'href'>) {
  const { t } = useTranslation()

  return (
    <Link
      to="/"
      className={cn('flex items-center gap-2 font-medium', className)}
      {...delegated}
    >
      <LetterMark />
      <span className="min-w-0 truncate">{t('app.name')}</span>
    </Link>
  )
}
