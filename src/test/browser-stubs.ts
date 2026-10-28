import { vi } from 'vitest'

// The route tree imports browser-only code (the theme store reads `window.matchMedia` when it is
// first imported, the login pages read `window.location.origin`). Router tests run in Node, so
// these are the few globals that code needs. Import this file FIRST in a router test, before
// anything that imports the route tree. It is not a `setupFiles` entry because
// src/i18n/language.test.ts calls `vi.unstubAllGlobals()` and would lose them.
//
// Keep `document`: when NODE_ENV is "test", the router decides between its server and client
// loaders by `typeof document`, and the app runs the client one.

const noop = () => {}

const documentElement = {
  lang: '',
  classList: { toggle: noop, add: noop, remove: noop },
}

// sonner puts its styles in a <style> element when it is imported.
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
