import * as React from 'react'

// The exact complement of Tailwind's `md` (`min-width: 48rem`), where the sidebar appears. A
// `max-width: 767px` would leave 767 to 768 px with neither the panel nor the sidebar.
export const MOBILE_QUERY = 'not (min-width: 48rem)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
  )
}
