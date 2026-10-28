import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// For component tests. A test file opts in with `// @vitest-environment jsdom` on its first line
// (the default stays Node, see vitest.config.ts) and imports this file FIRST, before anything
// that imports the route tree. It is not a `setupFiles` entry for the same reason as
// ./browser-stubs: src/i18n/language.test.ts calls `vi.unstubAllGlobals()`, and Node tests do
// not need it.

const noop = () => {}

// jsdom has no `matchMedia`, and the theme store reads it as soon as it is imported.
Object.defineProperty(window, 'matchMedia', {
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

// Testing Library only cleans up by itself when the test globals are on, and they are not.
afterEach(cleanup)
