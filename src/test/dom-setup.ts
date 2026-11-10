import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// For component tests. A test file sets `// @vitest-environment jsdom` on its first line and
// imports this file FIRST, before anything that imports the route tree. It is not a
// `setupFiles` entry for the same reason as ./browser-stubs: language.test.ts calls
// `vi.unstubAllGlobals()`, and Node tests do not need it.

const noop = () => {}

// jsdom has no `matchMedia` and the theme store reads it on import. The stubs are
// `configurable` so a test can replace them with `vi.stubGlobal`.
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  }),
})

// Radix measures popups (the sidebar tooltips) with ResizeObserver. jsdom has none, so an
// open tooltip would crash the page.
class ResizeObserverStub {
  observe = noop
  unobserve = noop
  disconnect = noop
}
Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: ResizeObserverStub,
})

// The router scrolls to the top after navigation; jsdom logs "not implemented".
window.scrollTo = noop

// Testing Library auto-cleans only when test globals are on, and they are off.
afterEach(cleanup)

// A guest's games are stored in `localStorage`, which jsdom keeps for the whole file: one test's records must not
// reach the next.
afterEach(() => window.localStorage.clear())
