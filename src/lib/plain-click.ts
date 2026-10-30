import type { MouseEvent } from 'react'

// A click the router follows itself, the same test TanStack Router's `Link` makes. Anything else
// (ctrl or cmd for a new tab, a middle button, a handler that cancelled it) is left to the browser,
// so the page stays where it is.
export function isPlainClick(event: MouseEvent) {
  return !(
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0 ||
    event.defaultPrevented
  )
}
