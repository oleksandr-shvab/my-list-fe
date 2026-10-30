import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type GameErrorBoundaryProps = {
  children: ReactNode
  // The game's name, for the page's h1: the screen's own h1 is not there while it has failed.
  heading: string
  // Called on "Try again", before the screen renders again.
  onRetry?: () => void
}
type GameErrorBoundaryState = { failed: boolean }

// One per game screen (AC-54): a screen that fails while rendering shows this inside the
// layout, so the sidebar and the header keep working. React still needs a class for this.
// The error is not reported here: `createRoot`'s `onCaughtError` (src/main.tsx) reports every
// error a boundary catches.
export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  state: GameErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): GameErrorBoundaryState {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <GameErrorFallback
        heading={this.props.heading}
        onRetry={() => {
          this.props.onRetry?.()
          this.setState({ failed: false })
        }}
      />
    )
  }
}

// "Try again" renders the screen again. If the screen's code failed to download, `lazy` keeps
// that failure, so the screen is built with `lazyWithRetry` and `onRetry` makes it download
// again. (src/lib/version-skew.ts only reloads the page for the deploy case.)
function GameErrorFallback({
  heading,
  onRetry,
}: {
  heading: string
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center"
      >
        <p className="text-sm text-muted-foreground">{t('games.error')}</p>
        <Button type="button" onClick={onRetry}>
          {t('error_screen.try_again')}
        </Button>
      </div>
    </>
  )
}
