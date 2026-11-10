// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameGuesserView, GuessRead } from '@/api/generated/models'
import i18n from '@/i18n'
import {
  gameView,
  GUEST,
  slowReply,
  startApp,
  type Reply,
} from '@/test/router-harness'

const PUZZLES = '/v1/games/game-guesser/puzzles'
const DAY = '2026-11-05'

let stop: (() => void) | undefined

function renderApp(path: string) {
  const app = startApp({ path, me: GUEST })
  stop = app.stop
  const { unmount } = render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return { ...app, unmount }
}

// Closes the page, to open another one in the same test.
function closeApp(app: ReturnType<typeof renderApp>) {
  app.unmount()
  app.stop()
  stop = undefined
  // The game played in the page is a stored guest record, and the next page would open it as one.
  localStorage.clear()
}

function serveClock(now: string, today: string, nextReset: string): Reply {
  return { status: 200, data: { now, today, next_reset: nextReset } }
}

const SERVER_TODAY = serveClock(
  '2026-11-05T12:00:00Z',
  DAY,
  '2026-11-06T00:00:00Z',
)
const SERVER_NEXT_DAY = serveClock(
  '2026-11-06T12:00:00Z',
  '2026-11-06',
  '2026-11-07T00:00:00Z',
)

const LOST: GuessRead[] = [1, 2, 3, 4, 5, 6].map((id) => ({
  title_id: id,
  name: `Game ${id}`,
  result: 'wrong',
}))

const lostView: GameGuesserView = gameView({
  date: DAY,
  signed_in: false,
  status: 'lost',
  guesses: LOST,
  guesses_used: 6,
  guesses_left: 0,
  answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
})

beforeEach(async () => {
  // A finished game of an earlier test is a stored guest record, and a page would open it as one.
  localStorage.clear()
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('sharing the result (AC-66, AC-67)', () => {
  it('copies the text and says so, and when copying is refused shows the same text in a selected, read-only box', async () => {
    // user-event puts its own clipboard on the page when it is set up, so ours goes on after.
    const user = userEvent.setup()
    const writeText = vi.fn<(text: string) => Promise<void>>()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })
    const expected = [
      'Daily Game Challenge: Game Guesser #308',
      '\u{1F7E5}'.repeat(6),
      'X/6',
      `${window.location.origin}/games/game-guesser/${DAY}`,
    ].join('\n')

    writeText.mockResolvedValueOnce()
    await user.click(
      await screen.findByRole('button', { name: 'Share result' }),
    )
    expect(await screen.findByText('Result copied')).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith(expected)
    expect(screen.queryByRole('textbox')).toBeNull()

    writeText.mockRejectedValueOnce(new Error('denied'))
    await user.click(screen.getByRole('button', { name: 'Share result' }))
    expect(
      await screen.findByText(
        "Couldn't copy. Select the text below and copy it.",
      ),
    ).toBeTruthy()
    expect(screen.queryByText('Result copied')).toBeNull()
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(box.readOnly).toBe(true)
    expect(box.value).toBe(expected)
    expect(box.selectionStart).toBe(0)
    expect(box.selectionEnd).toBe(expected.length)
    expect(document.activeElement).toBe(box)
  })
})

describe('a second press with no clipboard (AC-66, AC-67)', () => {
  it('draws the status line again and selects the box again, though the outcome is the same', async () => {
    const user = userEvent.setup()
    // The clipboard is missing, so the attempt fails in the same tick as the press.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })

    await user.click(
      await screen.findByRole('button', { name: 'Share result' }),
    )
    const region = await screen.findByText(
      "Couldn't copy. Select the text below and copy it.",
    )
    expect(document.activeElement).toBe(screen.getByRole('textbox'))

    let mutations = 0
    const observer = new MutationObserver((records) => {
      mutations += records.length
    })
    observer.observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    // The press moves the focus to the button; the second failure must bring it back to the selected box.
    await user.click(screen.getByRole('button', { name: 'Share result' }))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('textbox')),
    )
    observer.disconnect()

    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(box.selectionStart).toBe(0)
    expect(box.selectionEnd).toBe(box.value.length)
    // Emptied and filled again, so a screen reader hears it a second time.
    expect(mutations).toBeGreaterThan(0)
    expect(region.textContent).toBe(
      "Couldn't copy. Select the text below and copy it.",
    )
  })
})

describe('overlapping presses (AC-66, AC-67)', () => {
  it('keeps the result of the last press when an earlier, slower copy finishes after it', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn<(text: string) => Promise<void>>()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })
    // The first copy hangs; the second is refused at once.
    let finishFirst!: () => void
    writeText.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishFirst = resolve
      }),
    )
    writeText.mockRejectedValueOnce(new Error('denied'))

    await user.click(
      await screen.findByRole('button', { name: 'Share result' }),
    )
    await user.click(screen.getByRole('button', { name: 'Share result' }))
    expect(
      await screen.findByText(
        "Couldn't copy. Select the text below and copy it.",
      ),
    ).toBeTruthy()

    await act(async () => finishFirst())

    // The late success is for a press that is no longer the last.
    expect(screen.queryByText('Result copied')).toBeNull()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})

describe('the countdown on the end screen (AC-101, AC-103, AC-104)', () => {
  it("counts to the server's next reset by the server's offset, and at zero offers the new puzzle without loading it", async () => {
    // The device is an hour behind the server and five seconds from the server's midnight.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-05T22:59:55.000Z'))
    const app = renderApp('/')
    app.backend.replies.set(`${PUZZLES}/today`, {
      status: 200,
      data: lostView,
    })
    app.backend.replies.set('/v1/clock', () => ({
      status: 200,
      data: {
        now: new Date(Date.now() + 3_600_000).toISOString(),
        today: DAY,
        next_reset: '2026-11-06T00:00:00Z',
      },
    }))

    // By the device's clock it would be an hour and a bit.
    const timer = await screen.findByRole('timer')
    await waitFor(() =>
      expect(timer.textContent).toMatch(/^Next puzzle in 00:00:0[1-5]$/),
    )

    // Time passes: the server's midnight is now behind.
    vi.setSystemTime(new Date('2026-11-05T23:00:00.500Z'))
    expect(
      await screen.findByText('A new puzzle is ready', {}, { timeout: 3000 }),
    ).toBeTruthy()
    expect(screen.queryByRole('timer')).toBeNull()
    // Nothing was loaded by itself: one answer for today, and no puzzle after it.
    expect(
      app.backend.requests.filter((url) => url.startsWith(PUZZLES)),
    ).toEqual([`${PUZZLES}/today`])
    // The page that opened as today says its day has moved, as the zero is the moment to check (AC-48).
    expect(
      await screen.findByText(/A new day has started \(UTC\)/),
    ).toBeTruthy()
    // One link, the day-change message's: the countdown at zero shows only its text then.
    expect(
      screen.getAllByRole('link', { name: "Play today's puzzle" }),
    ).toHaveLength(1)
  })
})

describe('which last slot the end screen shows (Q9, AC-102)', () => {
  const COUNTDOWN = /^Next puzzle in \d\d:\d\d:\d\d$/
  const playToday = () =>
    screen.queryByRole('link', { name: "Play today's puzzle" })

  it("decides by the server's today, and shows nothing until the clock has answered", async () => {
    // A dated page, as the server's today: the countdown.
    let app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })
    app.backend.replies.set('/v1/clock', SERVER_TODAY)
    expect((await screen.findByRole('timer')).textContent).toMatch(COUNTDOWN)
    expect(playToday()).toBeNull()
    closeApp(app)

    // The same puzzle after the server's day moved on: a link to today's, and no countdown.
    app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })
    app.backend.replies.set('/v1/clock', SERVER_NEXT_DAY)
    const link = await screen.findByRole('link', {
      name: "Play today's puzzle",
    })
    expect(link.getAttribute('href')).toBe('/games/game-guesser')
    expect(screen.queryByRole('timer')).toBeNull()
    closeApp(app)

    // The clock is on its way: the puzzle shows and the slot is empty, whichever it will be.
    app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })
    const late = slowReply()
    app.backend.replies.set('/v1/clock', late.reply)
    await screen.findByRole('heading', { name: 'Not this time' })
    await act(async () => {})
    expect(screen.queryByRole('timer')).toBeNull()
    expect(playToday()).toBeNull()
    await act(async () => late.answer(SERVER_TODAY))
    expect((await screen.findByRole('timer')).textContent).toMatch(COUNTDOWN)
  })

  it("when the clock failed, a page opened from /today counts down on the device's clock, asking for the clock once", async () => {
    // The device's day is not the puzzle's, so only the page's opening can say it is today's.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    // A second past the hour: a part second counts as a whole one, so the first second still reads 14:00:00.
    vi.setSystemTime(new Date('2026-11-07T10:00:01.000Z'))

    const app = renderApp('/')
    app.backend.replies.set(`${PUZZLES}/today`, { status: 200, data: lostView })
    app.backend.replies.set('/v1/clock', 'network-error')
    const timer = await screen.findByRole('timer')
    // The device's next midnight is 14 hours away.
    expect(timer.textContent).toMatch(/^Next puzzle in 13:59:5\d$/)
    // The call is not repeated by the countdown (no retry, AC-76).
    expect(app.backend.count('/v1/clock')).toBe(1)
  })

  it('when the clock failed, a dated page shows the link to today, with no countdown', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-07T10:00:00.000Z'))

    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })
    app.backend.replies.set('/v1/clock', 'network-error')
    expect(
      await screen.findByRole('link', { name: "Play today's puzzle" }),
    ).toBeTruthy()
    expect(screen.queryByRole('timer')).toBeNull()
    expect(app.backend.count('/v1/clock')).toBe(1)
  })
})

describe('what the end screen says about the result (AC-63)', () => {
  const WON = (guesses: GuessRead[], used: number): GameGuesserView =>
    gameView({
      date: DAY,
      signed_in: false,
      status: 'won',
      guesses,
      guesses_used: used,
      guesses_left: 6 - used,
      answer: {
        title_id: 9,
        name: 'Zelda',
        franchise: 'Zelda series',
        year: 1998,
      },
    })
  const RIGHT: GuessRead = { title_id: 9, name: 'Zelda', result: 'correct' }
  const SKIP: GuessRead = { title_id: null, name: null, result: 'skipped' }

  it('counts every guess, skips too, with the plural of the language, and shows the year and the series only when the answer has them', async () => {
    let app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: WON([RIGHT], 1),
    })
    await screen.findByRole('heading', { name: 'You got it!' })
    expect(screen.getByText('Solved in 1 guess')).toBeTruthy()
    await act(() => i18n.changeLanguage('ru'))
    expect(screen.getByText('Угадано с 1 попытки')).toBeTruthy()
    await act(() => i18n.changeLanguage('en'))
    closeApp(app)

    // Two skips and a right guess are three guesses.
    app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: WON([SKIP, SKIP, RIGHT], 3),
    })
    expect(await screen.findByText('Solved in 3 guesses')).toBeTruthy()
    expect(screen.getByText('The answer: Zelda (1998)')).toBeTruthy()
    expect(screen.getByText('Series: Zelda series')).toBeTruthy()
    closeApp(app)

    // A loss with no year and no series.
    app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: {
        ...lostView,
        answer: { title_id: 9, name: 'Zelda', franchise: null, year: null },
      },
    })
    await screen.findByRole('heading', { name: 'Not this time' })
    expect(screen.getByText('The answer: Zelda')).toBeTruthy()
    expect(screen.queryByText(/Series:/)).toBeNull()
    expect(screen.queryByText(/Solved in/)).toBeNull()
    expect(screen.queryByText(/\(null\)|undefined/)).toBeNull()
  })
})

describe('the focus when a game ends (AC-64)', () => {
  it('moves to the end-screen heading when the game ends on the page, and stays where it is when a finished puzzle opens', async () => {
    const user = userEvent.setup()
    let app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: gameView({ date: DAY, signed_in: false }),
    })
    app.backend.replies.set(`${PUZZLES}/${DAY}/guesses`, {
      status: 200,
      data: lostView,
    })
    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    const heading = await screen.findByRole('heading', {
      name: 'Not this time',
    })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    closeApp(app)

    app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: lostView,
    })
    const opened = await screen.findByRole('heading', { name: 'Not this time' })
    await act(async () => {})
    expect(document.activeElement).not.toBe(opened)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('the clock under the end screen (AC-102, AC-105)', () => {
  const INPROGRESS = gameView({ date: DAY, signed_in: false })

  it('is asked once when the clock failed and the game ends during play', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: INPROGRESS,
    })
    app.backend.replies.set(`${PUZZLES}/${DAY}/guesses`, {
      status: 200,
      data: lostView,
    })
    app.backend.replies.set('/v1/clock', 'network-error')
    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await screen.findByRole('heading', { name: 'Not this time' })
    await act(async () => {})

    // The end screen shares the game's reader of the clock; its own would ask a failed clock again as it mounts.
    expect(app.backend.count('/v1/clock')).toBe(1)
  })

  it('shows one link to today when a page left hidden past midnight comes back', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'))
    const app = renderApp('/')
    app.backend.replies.set(`${PUZZLES}/today`, { status: 200, data: lostView })
    app.backend.replies.set('/v1/clock', SERVER_TODAY)
    await screen.findByRole('timer')

    // Midnight passes; the tab comes back, and the clock it asks for says the new day.
    vi.setSystemTime(new Date('2026-11-06T12:00:00Z'))
    app.backend.replies.set('/v1/clock', SERVER_NEXT_DAY)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    })
    await screen.findByText(/A new day has started \(UTC\)/)
    await waitFor(() => expect(app.backend.count('/v1/clock')).toBe(2))
    await waitFor(() => expect(screen.queryByRole('timer')).toBeNull())

    // The message's link, and none of the end screen's own.
    expect(
      screen.getAllByRole('link', { name: "Play today's puzzle" }),
    ).toHaveLength(1)
  })

  it('counts to the device’s next midnight when the clock answers with a reset it cannot read', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-07T10:00:01.000Z'))
    const app = renderApp('/')
    app.backend.replies.set(`${PUZZLES}/today`, { status: 200, data: lostView })
    app.backend.replies.set(
      '/v1/clock',
      serveClock('2026-11-07T10:00:01Z', '2026-11-07', 'soon'),
    )

    const timer = await screen.findByRole('timer')
    await waitFor(() =>
      expect(timer.textContent).toMatch(/^Next puzzle in 13:59:5\d$/),
    )
  })
})
