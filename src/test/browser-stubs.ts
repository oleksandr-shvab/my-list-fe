import { vi } from 'vitest'

// The route tree reads browser globals on import (the theme store reads `window.matchMedia`,
// the login pages read `window.location.origin`), and router tests run in Node. Import this
// file FIRST in a router test. It is not a `setupFiles` entry because
// src/i18n/language.test.ts calls `vi.unstubAllGlobals()` and would drop the stubs.
//
// Keep `document`: with NODE_ENV "test" the router picks its server or client loader by
// `typeof document`, and the app needs the client one.

const noop = () => {}

const documentElement = {
  lang: '',
  classList: { toggle: noop, add: noop, remove: noop },
}

// sonner injects a <style> element when imported.
const fakeDocument = {
  documentElement,
  head: { appendChild: noop },
  createElement: () => ({ appendChild: noop }),
  createTextNode: () => ({}),
}

const fakeWindow = {
  location: { origin: 'http://localhost:5173' },
  matchMedia: () => ({
    matches: false,
    addEventListener: noop,
    removeEventListener: noop,
  }),
  addEventListener: noop,
  removeEventListener: noop,
  document: fakeDocument,
}

vi.stubGlobal('window', fakeWindow)
vi.stubGlobal('self', fakeWindow)
vi.stubGlobal('document', fakeDocument)
