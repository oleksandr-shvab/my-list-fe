import { useCallback, useEffect, useState } from 'react'
import { serverToday, type ServerClock } from '@/features/clock/clock'

// Says when the server's day, by the clock offset at the moment of the check, has moved past the puzzle a page with no
// date opened with (AC-47); it never switches anything itself. It checks when the tab becomes visible, and `check`
// serves a submit and the countdown (AC-48).
// The clock is the page's one reader of the clock query, passed in.
export function useDayChange(
  openedDate: string | null,
  { offsetMs, source }: ServerClock,
) {
  // Once the day has moved it stays moved.
  const [changed, setChanged] = useState(false)

  const check = useCallback(() => {
    // The device's clock never decides.
    if (openedDate === null || source !== 'server') return
    if (serverToday({ offsetMs }) > openedDate) {
      setChanged(true)
    }
  }, [openedDate, offsetMs, source])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [check])

  return { changed, check }
}
