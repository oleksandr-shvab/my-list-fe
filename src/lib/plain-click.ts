import type { MouseEvent } from 'react'

// A click the router follows itself, as TanStack Router's `Link` tests it. Other clicks (ctrl or cmd,
// middle button, cancelled) are left to the browser.
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
