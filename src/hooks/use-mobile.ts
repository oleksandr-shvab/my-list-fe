import { useMediaQuery } from './use-media-query'

// The exact complement of Tailwind's `md` (`min-width: 48rem`), where the sidebar appears. A
// `max-width: 767px` would leave 767 to 768 px with neither the panel nor the sidebar.
export const MOBILE_QUERY = 'not (min-width: 48rem)'

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY)
}
