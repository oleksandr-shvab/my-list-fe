import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { GameErrorBoundary } from './game-error-boundary'
import type { GameEntry } from './types'

type GameScreenHostProps = {
  game: GameEntry
  // The puzzle day as YYYY-MM-DD, in UTC.
  date: string
  isToday: boolean
}

// Shows a game's own screen. The screen's code downloads when this first renders (AC-53), and a
// failure inside it stays inside the boundary (AC-54).
export function GameScreen({ game, date, isToday }: GameScreenHostProps) {
  const { t } = useTranslation()

  // The key restarts the boundary and the screen for another game or day. It never includes the
  // language: a language switch must keep the screen and its state (AC-55a).
  return (
    <GameErrorBoundary key={`${game.slug}/${date}`}>
      <Suspense
        fallback={
          <p
            role="status"
            className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
          >
            {t('games.loading')}
          </p>
        }
      >
        <game.screen slug={game.slug} date={date} isToday={isToday} />
      </Suspense>
    </GameErrorBoundary>
  )
}
