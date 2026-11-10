// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { GUEST, slowReply, startApp, type Reply } from '@/test/router-harness'
import { useServerClock, type ServerClock } from './clock'
import { Countdown } from './countdown'

const CLOCK_URL = '/v1/clock'
const TIME = /^Next puzzle in \d\d:\d\d:\d\d$/

let stop: (() => void) | undefined

// The server agrees with the device and its next reset is an hour away.
function clockReply(): Reply {
  const now = Date.now()
  return {
    status: 200,
    data: {
      now: new Date(now).toISOString(),
      today: '2026-11-05',
      next_reset: new Date(now + 3_600_000).toISOString(),
    },
  }
}

// The page reads the clock and passes it down, as the end screen does.
function WithClock() {
  const clock = useServerClock()
  return <Countdown clock={clock} action={<a href="/play">Play</a>} />
}

function renderCountdown() {
  const app = startApp({ path: '/', me: GUEST })
  stop = app.stop
  app.backend.replies.set(CLOCK_URL, clockReply())
  const view = render(
    <QueryClientProvider client={app.queryClient}>
      <WithClock />
    </QueryClientProvider>,
  )
  return { app, ...view }
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Countdown (AC-101, AC-104, AC-105)', () => {
  it('shows dashes, not a time, while the clock is asked again after the tab becomes visible', async () => {
    const { app } = renderCountdown()
    await waitFor(() =>
      expect(screen.getByRole('timer').textContent).toMatch(TIME),
    )

    const late = slowReply()
    app.backend.replies.set(CLOCK_URL, late.reply)
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    await waitFor(() =>
      expect(screen.getByRole('timer').textContent).toBe(
        'Next puzzle in --:--:--',
      ),
    )

    await act(async () => late.answer(clockReply()))
    await waitFor(() =>
      expect(screen.getByRole('timer').textContent).toMatch(TIME),
    )
  })

  it('takes the time again when the clock has answered after a long while, instead of counting from the last tick', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'))
    const clock: ServerClock = {
      ready: true,
      isFetching: false,
      source: 'server',
      today: '2026-11-05',
      nextReset: '2026-11-05T12:01:00.000Z',
      offsetMs: 0,
    }
    const onZero = vi.fn()
    const { rerender } = render(<Countdown clock={clock} onZero={onZero} />)
    expect(screen.getByRole('timer').textContent).toBe(
      'Next puzzle in 00:01:00',
    )

    // The tab was hidden for 90 s with its timers throttled; it comes back and asks for the clock.
    vi.setSystemTime(new Date('2026-11-05T12:01:30.000Z'))
    rerender(
      <Countdown clock={{ ...clock, isFetching: true }} onZero={onZero} />,
    )
    rerender(<Countdown clock={{ ...clock }} onZero={onZero} />)
    act(() => void vi.advanceTimersByTime(0))

    // The reset is behind: not a minute left.
    expect(screen.getByRole('status').textContent).toBe('A new puzzle is ready')
    expect(onZero).toHaveBeenCalled()
  })

  it('reaches zero when the reset does, says so in the live region that was already there, and stops its timer when it leaves the page', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'))
    const clock: ServerClock = {
      ready: true,
      isFetching: false,
      source: 'server',
      today: '2026-11-05',
      // 2.5 s away: a one-second interval from mount would tick at 1 s and 2 s and see zero only at 3 s.
      nextReset: '2026-11-05T12:00:02.500Z',
      offsetMs: 0,
    }
    const onZero = vi.fn()
    const { unmount } = render(
      <Countdown
        clock={clock}
        onZero={onZero}
        action={<a href="/p">Play</a>}
      />,
    )
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')

    // Each tick sets the next one when it has rendered, so time goes in steps, as the second changes.
    act(() => void vi.advanceTimersByTime(500))
    act(() => void vi.advanceTimersByTime(1000))
    act(() => void vi.advanceTimersByTime(999))
    expect(onZero).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))

    expect(onZero).toHaveBeenCalled()
    // The same element gets the text, so a screen reader hears it.
    expect(screen.getByRole('status')).toBe(region)
    expect(region.textContent).toBe('A new puzzle is ready')
    expect(screen.queryByRole('timer')).toBeNull()

    // A countdown left before its reset leaves no timer behind.
    const second = render(
      <Countdown
        clock={{ ...clock, nextReset: '2026-11-05T12:00:12.000Z' }}
        onZero={onZero}
      />,
    )
    expect(vi.getTimerCount()).toBe(1)
    second.unmount()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
