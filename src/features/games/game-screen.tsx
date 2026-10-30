import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GameErrorBoundary } from './game-error-boundary'
import type { GameEntry } from './types'

type GameScreenHostProps = {
  game: GameEntry
  // The puzzle day as YYYY-MM-DD, in UTC.
  date: string
  isToday: boolean
}

// Shown while the screen's code downloads. It has no text: the always-mounted status region in
// `GameScreen` gets it, because a live region only announces a change, not a node that is
// inserted with its text already in it. A layout effect, so the status never lags a commit
// behind the screen (it must be empty when the error is shown).
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

// Shows a game's own screen. The screen's code downloads when this first renders (AC-53), and a
// failure inside it stays inside the boundary (AC-54).
export function GameScreen({ game, date, isToday }: GameScreenHostProps) {
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

  // The key restarts the boundary and the screen for another game or day. It never includes the
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
        key={`${game.slug}/${date}`}
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
          <game.screen slug={game.slug} date={date} isToday={isToday} />
        </Suspense>
      </GameErrorBoundary>
    </div>
  )
}
