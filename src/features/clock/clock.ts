import { queryOptions, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { clockGetClock } from '@/api/generated/api'
import { todayUtc } from '@/lib/utc-date'

// The server's time is for display only: what is visible, the streak and the archive are decided by the server
// (CONTRACTS.md, "Clock"). The device's clock is the fallback when the call fails.
export function clockQueryOptions() {
  return queryOptions({
    queryKey: ['clock'] as const,
    queryFn: async ({ signal }) => {
      const clock = await clockGetClock({ signal })
      return {
        today: clock.today,
        nextReset: clock.next_reset,
        // Server minus device, measured when the answer arrived.
        offsetMs: Date.parse(clock.now) - Date.now(),
      }
    },
    // A failed clock is no reason to delay the page, and the fallback is good enough (AC-76, AC-102).
    retry: false,
    staleTime: Infinity,
    // The page was hidden and came back: the offset may be stale (AC-105).
    refetchOnWindowFocus: 'always',
  })
}

function deviceClock() {
  const now = new Date()
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  )
  return {
    today: todayUtc(now),
    nextReset: new Date(midnight).toISOString(),
    offsetMs: 0,
  }
}

export function useServerClock() {
  const { data, isFetched, isFetching } = useQuery(clockQueryOptions())

  // The device's guess is worked out when the answer changes, not on every render, and only while there is none. An
  // answer whose reset or time cannot be read counts as a failed call (AC-102): a countdown to NaN helps no one.
  const clock = useMemo(
    () =>
      data &&
      Number.isFinite(Date.parse(data.nextReset)) &&
      Number.isFinite(data.offsetMs)
        ? { ...data, source: 'server' as const }
        : { ...deviceClock(), source: 'device' as const },
    [data],
  )

  return {
    // False only until the first answer or failure; asking again never takes it back, so what is shown on it does not
    // unmount (a component that unmounts and mounts again asks a failed clock again, and so on without end).
    ready: isFetched,
    // A call is on its way: the first one, or the one after the tab became visible (AC-105).
    isFetching,
    // `device` is for a guest's own numbers (AC-76) and the countdown (AC-102), never for what is visible.
    ...clock,
  }
}

// The server's UTC day right now, by the offset measured when the clock answered. With the device fallback the offset is
// 0, so it is the device's UTC day.
export function serverToday({
  offsetMs,
}: Pick<ServerClock, 'offsetMs'>): string {
  return todayUtc(new Date(Date.now() + offsetMs))
}

// hh:mm:ss for what is left; a part second counts as a whole one, so 00:00:00 is only shown when it is over.
export function formatCountdown(remainingMs: number): string {
  // Never NaN, whatever came in.
  const total = Number.isFinite(remainingMs)
    ? Math.max(0, Math.ceil(remainingMs / 1000))
    : 0
  const part = (n: number) => String(n).padStart(2, '0')
  return `${part(Math.floor(total / 3600))}:${part(Math.floor(total / 60) % 60)}:${part(total % 60)}`
}

export type ServerClock = ReturnType<typeof useServerClock>
