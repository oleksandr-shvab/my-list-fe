import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GameErrorBoundary } from './game-error-boundary'
import type { GameEntry } from './types'

type GameScreenHostProps = {
  game: GameEntry
  date: string | null
  // Changes when the player visits a page without a date again (`nextOpening`).
  opening?: number
}

// Has no text: the always-mounted status region in `GameScreen` gets it, because a live region announces
// a change, not a node inserted with its text. A layout effect keeps the status from lagging a commit behind.
function LoadingMarker({
  onLoadingChange,
}: {
  onLoadingChange: (on: boolean) => void
}) {
  useLayoutEffect(() => {
    onLoadingChange(true)
    return () => onLoadingChange(false)
  }, [onLoadingChange])
  return null
}

export function GameScreen({ game, date, opening }: GameScreenHostProps) {
  const { t } = useTranslation()
  const areaRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const gameName = t(game.nameKey)

  // "Try again" removes the button that has the focus. Moving the focus to the game area first
  // keeps it there instead of letting it fall to the page. Only a retry does this.
  function handleRetry() {
    game.screen.reload?.()
    areaRef.current?.focus()
  }

  // The key restarts the boundary and the screen for another game, day or visit. It never includes the
  // language: a language switch must keep the screen and its state (AC-55a).
  return (
    <div
      ref={areaRef}
      tabIndex={-1}
      className="flex flex-1 flex-col outline-none"
    >
      <p
        role="status"
        className={cn(
          'text-sm text-muted-foreground',
          loading && 'flex flex-1 items-center justify-center',
        )}
      >
        {loading ? t('games.loading') : ''}
      </p>
      <GameErrorBoundary
        key={`${game.slug}/${date ?? 'today'}/${opening ?? 0}`}
        heading={gameName}
        onRetry={handleRetry}
      >
        <Suspense
          fallback={
            <>
              {/* The page needs an h1 before the screen's own one exists. */}
              <h1 className="sr-only">{gameName}</h1>
              <LoadingMarker onLoadingChange={setLoading} />
            </>
          }
        >
          <game.screen slug={game.slug} date={date} />
        </Suspense>
      </GameErrorBoundary>
    </div>
  )
}
