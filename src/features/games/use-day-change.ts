import { useCallback, useEffect, useState } from 'react'
import { useServerClock } from '@/features/clock/clock'
import { todayUtc } from '@/lib/utc-date'

// Says when the server's day, by the clock offset at the moment of the check, has moved past the puzzle a page with no
// date opened with (AC-47); it never switches anything itself. It checks when the tab becomes visible, and `check`
// serves a submit and the countdown (AC-48).
export function useDayChange(openedDate: string | null) {
  const { offsetMs, source } = useServerClock()
  // Once the day has moved it stays moved.
  const [changed, setChanged] = useState(false)

  const check = useCallback(() => {
    // The device's clock never decides.
    if (openedDate === null || source !== 'server') return
    if (todayUtc(new Date(Date.now() + offsetMs)) > openedDate) {
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
