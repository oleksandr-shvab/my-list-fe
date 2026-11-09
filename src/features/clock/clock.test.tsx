// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUEST, startApp, type Reply } from '@/test/router-harness'
import { useServerClock } from './clock'

const CLOCK_URL = '/v1/clock'

let stop: (() => void) | undefined

function renderClock(reply: Reply) {
  const app = startApp({ path: '/', me: GUEST })
  stop = app.stop
  // Set before the render: the hook asks for the clock as it mounts.
  app.backend.replies.set(CLOCK_URL, reply)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={app.queryClient}>
      {children}
    </QueryClientProvider>
  )
  return { app, ...renderHook(() => useServerClock(), { wrapper }) }
}

function clockReply(now: string, today: string, nextReset: string) {
  return {
    status: 200,
    data: { now, today, next_reset: nextReset },
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-09T23:30:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useServerClock (AC-76, AC-102, AC-105)', () => {
  it('falls back to the device UTC day and its next midnight when the call fails', async () => {
    const { app, result } = renderClock('network-error')

    // Until the first answer the device's day is only a guess.
    expect(result.current.ready).toBe(false)
    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current).toMatchObject({
      offsetMs: 0,
      today: '2026-11-09',
      nextReset: '2026-11-10T00:00:00.000Z',
    })
    // No retry: a failed clock must not delay or repeat.
    expect(app.backend.count(CLOCK_URL)).toBe(1)
  })

  it("takes the server's day and offset, and measures the offset again when the page becomes visible", async () => {
    // The device is 5 minutes behind the server, and the server's day has already turned.
    const { app, result } = renderClock(
      clockReply(
        '2026-11-09T23:35:00Z',
        '2026-11-10',
        '2026-11-11T00:00:00+00:00',
      ),
    )

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current).toMatchObject({
      offsetMs: 5 * 60_000,
      today: '2026-11-10',
      nextReset: '2026-11-11T00:00:00+00:00',
    })

    app.backend.replies.set(
      CLOCK_URL,
      clockReply(
        '2026-11-09T23:40:00Z',
        '2026-11-10',
        '2026-11-11T00:00:00+00:00',
      ),
    )
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))

    await waitFor(() => expect(result.current.offsetMs).toBe(10 * 60_000))
    expect(app.backend.count(CLOCK_URL)).toBe(2)
  })
})
