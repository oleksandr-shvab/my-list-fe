import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dismissNudge, isNudgeDismissed } from './guest-records'

const LINK_BUTTON = 'max-md:h-11'

// The offer on a guest's won end screen, until "Not now" is pressed once in this browser (AC-90, AC-93); never a pop-up.
// Its links carry the won puzzle's own page as `redirect`: a today address is another puzzle after midnight.
export function SignUpNudge({
  slug,
  date,
  onDismiss,
}: {
  slug: string
  date: string
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const href = `/games/${slug}/${date}`
  // Read when the card mounts, so a later win shows nothing once it was dismissed (AC-93).
  const [dismissed, setDismissed] = useState(isNudgeDismissed)

  if (dismissed) return null
  return (
    <section
      aria-label={t('games.nudge.label')}
      className="flex max-w-xl flex-col gap-3 rounded-lg border bg-muted/40 p-4"
    >
      <p>{t('games.nudge.text')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/register"
          search={{ redirect: href }}
          className={cn(buttonVariants(), LINK_BUTTON)}
        >
          {t('games.nudge.sign_up')}
        </Link>
        <Link
          to="/login"
          search={{ redirect: href }}
          className={cn(buttonVariants({ variant: 'outline' }), LINK_BUTTON)}
        >
          {t('games.nudge.log_in')}
        </Link>
        <Button
          type="button"
          variant="ghost"
          className={LINK_BUTTON}
          onClick={() => {
            dismissNudge()
            setDismissed(true)
            // The button that had the focus is gone.
            onDismiss()
          }}
        >
          {t('games.nudge.not_now')}
        </Button>
      </div>
    </section>
  )
}
