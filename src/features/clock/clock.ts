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
  const { data, isPending } = useQuery(clockQueryOptions())

  // The device's guess is worked out when the answer changes, not on every render, and only while there is none.
  const clock = useMemo(
    () =>
      data
        ? { ...data, source: 'server' as const }
        : { ...deviceClock(), source: 'device' as const },
    [data],
  )

  return {
    // False while the first answer is on its way.
    ready: !isPending,
    // `device` is for a guest's own numbers (AC-76) and the countdown (AC-102), never for what is visible.
    ...clock,
  }
}
