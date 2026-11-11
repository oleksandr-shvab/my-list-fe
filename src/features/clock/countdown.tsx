import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCountdown, type ServerClock } from './clock'

const PLACEHOLDER = '--:--:--'

type CountdownProps = {
  // Read by the page and passed in: a second reader of the clock query that mounts and unmounts with the countdown
  // would ask a failed clock again each time.
  clock: ServerClock
  // Called when the countdown is at zero (the page checks whether its day has moved).
  onZero?: () => void
  // What the player can do at zero, such as a link to the new puzzle. Nothing loads by itself (AC-104).
  action?: ReactNode
}

// "Next puzzle in hh:mm:ss" to the server's next reset, by the server's offset (AC-101). When the clock call failed
// the hook falls back to the device's next 00:00 UTC (AC-102).
export function Countdown({ clock, onZero, action }: CountdownProps) {
  const { t } = useTranslation()
  // The time is not shown while the clock is on its way, also after the tab was hidden (AC-105).
  const settled = clock.ready && !clock.isFetching
  const [now, setNow] = useState(() => Date.now())

  const resetAt = Date.parse(clock.nextReset)
  const remaining = resetAt - (now + clock.offsetMs)
  const zero = settled && remaining <= 0

  // Each tick is set for the moment the shown second changes, so zero comes when the reset does and not up to a second
  // later (AC-101). A `now` that is a second old or more (timers are throttled while the tab is hidden, and `now` stands
  // still while the clock is asked again, AC-105) is taken again at once, before it is trusted.
  useEffect(() => {
    if (!settled || zero) return
    const current = Date.now()
    const stale = current - now >= 1000
    const left = resetAt - (current + clock.offsetMs)
    const id = setTimeout(
      () => setNow(Date.now()),
      stale ? 0 : left % 1000 || 1000,
    )
    return () => clearTimeout(id)
  }, [settled, zero, now, resetAt, clock.offsetMs])

  useEffect(() => {
    if (zero) onZero?.()
  }, [zero, onZero])

  return (
    <div>
      {/* A timer is not a live region: it is read on demand, not every second (AC-104). */}
      {!zero && (
        <p role="timer" className="text-sm tabular-nums">
          {t('games.countdown', {
            time: settled ? formatCountdown(remaining) : PLACEHOLDER,
          })}
        </p>
      )}
      {/* Always there, so the text that arrives at zero is announced. */}
      <p role="status" className="font-medium">
        {zero && t('games.countdown_done')}
      </p>
      {zero && action && <div className="mt-2">{action}</div>}
    </div>
  )
}
