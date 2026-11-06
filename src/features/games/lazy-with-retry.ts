import { createElement, lazy, type ComponentType } from 'react'
import type { GameScreenComponent, GameScreenProps } from './types'

type Load = () => Promise<{ default: ComponentType<GameScreenProps> }>

// `lazy` keeps a failed import for good, so a retry in the error boundary would throw the same error.
// This builds a new lazy component when `reload` is called. src/lib/version-skew.ts is a separate path:
// it reloads the whole page on Vite's `vite:preloadError`.
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
