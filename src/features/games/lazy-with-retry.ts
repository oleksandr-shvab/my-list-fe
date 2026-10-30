import { createElement, lazy, type ComponentType } from 'react'
import type { GameScreenComponent, GameScreenProps } from './types'

type Load = () => Promise<{ default: ComponentType<GameScreenProps> }>

// `lazy` keeps a failed import for good: the same rejected component throws on every render, so
// a retry in the error boundary would show the same error. This wraps the lazy component and
// builds a new one when `reload` is called after a failed download (the boundary does that on
// "Try again"). The reload-once handler in src/lib/version-skew.ts is a separate path: it only
// reacts to Vite's `vite:preloadError` and reloads the whole page.
export function lazyWithRetry(load: Load): GameScreenComponent {
  let failed = false
  const loadAndNote: Load = () =>
    load().catch((error: unknown) => {
      failed = true
      throw error
    })
  let Inner = lazy(loadAndNote)

  function Screen(props: GameScreenProps) {
    return createElement(Inner, props)
  }
  Screen.reload = () => {
    if (!failed) return
    failed = false
    Inner = lazy(loadAndNote)
  }
  return Screen
}
