// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterContextProvider, RouterProvider } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameGuesserView, GuessRead } from '@/api/generated/models'
import i18n from '@/i18n'
import { reportError } from '@/lib/report-error'
import {
  gameView,
  GUEST,
  SERVER_ERROR,
  SIGNED_IN,
  slowReply,
  startApp,
  type Reply,
} from '@/test/router-harness'
import type { ServerClock } from '@/features/clock/clock'
import { writeGuestRecord } from '../guest-records'
import { StatsDialog } from './stats-dialog'

vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }))

// The dialog alone, with the router's context and a clock whose answer is as old as the page. `update` shows another
// state of the same game, as a page does when a guess is answered.
function renderDialog(options: {
  me: Reply
  viewer: string
  view?: Partial<GameGuesserView>
  clock?: Partial<ServerClock>
}) {
  const app = startApp({ path: '/', me: options.me })
  stop = app.stop
  const page = (view?: Partial<GameGuesserView>) => (
    <QueryClientProvider client={app.queryClient}>
      <RouterContextProvider router={app.router}>
        <StatsDialog
          slug={SLUG}
          viewer={options.viewer}
          view={gameView({ date: DAY, ...options.view, ...view })}
          clock={{
            ready: true,
            isFetching: false,
            source: 'server',
            today: DAY,
            nextReset: '2026-11-06T00:00:00Z',
            offsetMs: 0,
            ...options.clock,
          }}
        />
      </RouterContextProvider>
    </QueryClientProvider>
  )
  const shown = render(page())
  return {
    ...app,
    update: (view: Partial<GameGuesserView>) => shown.rerender(page(view)),
  }
}

const SLUG = 'game-guesser'
const DAY = '2026-11-05'
const PUZZLES = `/v1/games/${SLUG}/puzzles`
const STATS_URL = `/v1/games/${SLUG}/stats`
const CLOCK: Reply = {
  status: 200,
  data: {
    now: '2026-11-05T12:00:00Z',
    today: DAY,
    next_reset: '2026-11-06T00:00:00Z',
  },
}

let stop: (() => void) | undefined

function wrong(id: number): GuessRead {
  return { title_id: id, name: `Game ${id}`, result: 'wrong' }
}
const SOLVED: GuessRead[] = [
  wrong(1),
  wrong(2),
  { title_id: 9, name: 'Zelda', result: 'correct' },
]

function record(
  date: string,
  status: 'won' | 'lost',
  guesses: GuessRead[],
  countsForStreak: boolean | null = true,
) {
  writeGuestRecord(
    { slug: SLUG, variant: 'default', date },
    {
      guesses,
      status,
      counts_for_streak: countsForStreak,
      daily_proof: null,
    },
  )
}

// The text of the figure under a label ("Played" -> "3").
function figure(dialog: HTMLElement, label: string): string | null | undefined {
  return within(dialog).getByText(label).parentElement?.querySelector('dd')
    ?.textContent
}

function renderApp(path: string, me: Reply) {
  const app = startApp({ path, me })
  stop = app.stop
  app.backend.replies.set('/v1/clock', CLOCK)
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

beforeEach(async () => {
  vi.mocked(reportError).mockClear()
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the statistics dialog for a guest (AC-70, AC-72, AC-74, AC-77, AC-78)', () => {
  it('computes the numbers from the browser records, marks the game just won, offers sign-up and returns the focus on Escape', async () => {
    // Day 3 was played from the archive: it counts as played and won, but fills no streak day.
    record('2026-11-03', 'won', SOLVED.slice(1), false)
    record('2026-11-04', 'lost', [1, 2, 3, 4, 5, 6].map(wrong))
    record(DAY, 'won', SOLVED)
    const user = userEvent.setup()
    const app = renderApp(`/games/${SLUG}/${DAY}`, GUEST)
    app.backend.replies.set(`${PUZZLES}/${DAY}/resume`, {
      status: 200,
      data: gameView({
        date: DAY,
        signed_in: false,
        status: 'won',
        guesses: SOLVED,
        guesses_used: 3,
        guesses_left: 3,
        answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
      }),
    })

    // The end screen has its own button, after the header's.
    const buttons = await screen.findAllByRole('button', {
      name: 'Statistics',
    })
    expect(buttons).toHaveLength(2)
    await user.click(buttons[1])

    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    // Three finished games, two won; the streak days are 4 and 5.
    expect(figure(dialog, 'Played')).toBe('3')
    expect(figure(dialog, 'Win %')).toBe('67')
    expect(figure(dialog, 'Current streak')).toBe('2')
    expect(figure(dialog, 'Max streak')).toBe('2')
    const rows = within(dialog).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      '10',
      '21',
      '31This game',
      '40',
      '50',
      '60',
    ])
    expect(within(dialog).getByText(/Stats from this browser\./)).toBeTruthy()
    const signUp = within(dialog).getByRole('link', { name: 'Sign up' })
    expect(signUp.getAttribute('href')).toBe(
      `/register?redirect=${encodeURIComponent(`/games/${SLUG}/${DAY}`)}`,
    )

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(buttons[1])
  })
})

describe('the statistics dialog for a guest, more rules (AC-70, AC-71, AC-72, AC-76, AC-78)', () => {
  it('opens from the header on a game in progress, and when the clock failed counts the streak against the device day; a record with no flag is played but no streak day', async () => {
    // The device's day, with the clock call failing: 2026-11-10.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'))
    // The flag was never set (null): it is a played win, but its day fills no streak.
    record('2026-11-08', 'won', SOLVED, null)
    record('2026-11-09', 'lost', [1, 2, 3, 4, 5, 6].map(wrong))
    const user = userEvent.setup()
    const app = renderApp(`/games/${SLUG}/${DAY}`, GUEST)
    app.backend.replies.set('/v1/clock', SERVER_ERROR)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: gameView({ date: DAY, signed_in: false }),
    })

    // A game in progress has no end screen: the header's button is the only one.
    const button = await screen.findByRole('button', { name: 'Statistics' })
    await user.click(button)

    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    expect(figure(dialog, 'Played')).toBe('2')
    expect(figure(dialog, 'Win %')).toBe('50')
    // Yesterday (day 9) is the only streak day: still running.
    expect(figure(dialog, 'Current streak')).toBe('1')
    expect(figure(dialog, 'Max streak')).toBe('1')
    expect(within(dialog).queryByText('This game')).toBeNull()

    // The close button closes it and the focus goes back to the header's button.
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('shows zeros, and no bar marked, for a guest who played nothing', async () => {
    const user = userEvent.setup()
    renderDialog({ me: GUEST, viewer: 'guest', view: { signed_in: false } })

    await user.click(screen.getByRole('button', { name: 'Statistics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    // 0 of 0 is 0 %, not NaN.
    for (const label of ['Played', 'Win %', 'Current streak', 'Max streak']) {
      expect(figure(dialog, label)).toBe('0')
    }
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['10', '20', '30', '40', '50', '60'])
  })

  it('marks no bar on the end screen of a lost game (AC-72)', async () => {
    record(DAY, 'lost', [1, 2, 3, 4, 5, 6].map(wrong))
    const user = userEvent.setup()
    const app = renderApp(`/games/${SLUG}/${DAY}`, GUEST)
    app.backend.replies.set(`${PUZZLES}/${DAY}/resume`, {
      status: 200,
      data: gameView({
        date: DAY,
        signed_in: false,
        status: 'lost',
        guesses: [1, 2, 3, 4, 5, 6].map(wrong),
        guesses_used: 6,
        guesses_left: 0,
        answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
      }),
    })

    const buttons = await screen.findAllByRole('button', {
      name: 'Statistics',
    })
    await user.click(buttons[1])

    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    expect(figure(dialog, 'Played')).toBe('1')
    expect(figure(dialog, 'Win %')).toBe('0')
    expect(within(dialog).queryByText('This game')).toBeNull()
  })
})

describe('the statistics dialog for an account (AC-73)', () => {
  it('shows placeholders while the numbers load, then the server numbers, and after a failure asks again on "Try again"', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/${SLUG}/${DAY}`, SIGNED_IN)
    app.backend.replies.set(`${PUZZLES}/${DAY}`, {
      status: 200,
      data: gameView({ date: DAY }),
    })
    const slow = slowReply()
    app.backend.replies.set(STATS_URL, slow.reply)

    await user.click(await screen.findByRole('button', { name: 'Statistics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    // All four figures wait, the win rate too.
    expect(dialog.querySelectorAll('dd [data-slot="skeleton"]')).toHaveLength(4)
    expect(
      within(dialog).queryByText('Stats from this browser.', { exact: false }),
    ).toBeNull()

    slow.answer({
      status: 200,
      data: {
        played: 12,
        wins: 9,
        current_streak: 4,
        max_streak: 7,
        distribution: { '1': 0, '2': 3, '3': 4, '4': 2, '5': 0, '6': 0 },
      },
    })
    expect(await within(dialog).findByText('75')).toBeTruthy()
    expect(figure(dialog, 'Played')).toBe('12')
    expect(figure(dialog, 'Current streak')).toBe('4')
    expect(figure(dialog, 'Max streak')).toBe('7')
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['10', '23', '34', '42', '50', '60'])

    // Opened again, the old numbers are gone while the new ones load; then the request fails.
    await user.keyboard('{Escape}')
    const second = slowReply()
    app.backend.replies.set(STATS_URL, second.reply)
    await user.click(screen.getByRole('button', { name: 'Statistics' }))
    const reopened = await screen.findByRole('dialog', { name: 'Statistics' })
    expect(figure(reopened, 'Played')).toBe('')
    second.answer({
      status: 404,
      data: { status: 404, code: 'game_not_found', request_id: 'r' },
    })
    const failed = await screen.findByRole('alert')
    expect(failed.textContent).not.toBe('')
    app.backend.replies.set(STATS_URL, {
      status: 200,
      data: {
        played: 1,
        wins: 1,
        current_streak: 1,
        max_streak: 1,
        distribution: { '1': 1, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 },
      },
    })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('100')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the guest numbers when the stats request answers 401 (AC-79)', async () => {
    record('2026-11-04', 'won', SOLVED)
    const user = userEvent.setup()
    // No session check runs here, so the guard stays out of it and the dialog's own rule is what shows.
    const app = renderDialog({ me: SIGNED_IN, viewer: 'user-1' })
    app.backend.replies.set(STATS_URL, {
      status: 401,
      data: { status: 401, code: 'not_authenticated', request_id: 'r' },
    })

    await user.click(screen.getByRole('button', { name: 'Statistics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    expect(
      await within(dialog).findByText(/Stats from this browser\./),
    ).toBeTruthy()
    expect(figure(dialog, 'Played')).toBe('1')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    // The 401 is an answer the dialog handles, not a fault for the error tracker.
    expect(reportError).not.toHaveBeenCalled()
  })
})

describe('the statistics dialog, moments and failures (AC-73, AC-74)', () => {
  it('counts a guest against the server day at the moment it opens, not the day the clock answered', async () => {
    record(DAY, 'won', SOLVED)
    // The page has been open since the clock answered on day 5; it is now four days later, so day 5 is long past.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T00:00:01Z'))
    const user = userEvent.setup()
    renderDialog({ me: GUEST, viewer: 'guest', view: { signed_in: false } })

    await user.click(screen.getByRole('button', { name: 'Statistics' }))

    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    expect(figure(dialog, 'Current streak')).toBe('0')
    expect(figure(dialog, 'Max streak')).toBe('1')
  })

  it('shows a guess that was answered after the dialog opened', async () => {
    record('2026-11-04', 'won', SOLVED)
    const user = userEvent.setup()
    const page = renderDialog({
      me: GUEST,
      viewer: 'guest',
      view: { signed_in: false },
    })
    await user.click(screen.getByRole('button', { name: 'Statistics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    expect(figure(dialog, 'Played')).toBe('1')

    // The guess on its way when the dialog opened is answered: the record is written, then the page shows the game.
    record(DAY, 'lost', [1, 2, 3, 4, 5, 6].map(wrong))
    page.update({ status: 'lost', guesses_used: 6 })

    expect(figure(dialog, 'Played')).toBe('2')
  })

  it('keeps the numbers on screen when a later request for them fails', async () => {
    const user = userEvent.setup()
    const app = renderDialog({
      me: SIGNED_IN,
      viewer: 'user-1',
    })
    app.backend.replies.set(STATS_URL, {
      status: 200,
      data: {
        played: 4,
        wins: 2,
        current_streak: 1,
        max_streak: 2,
        distribution: { '2': 1, '3': 1 },
      },
    })
    await user.click(screen.getByRole('button', { name: 'Statistics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Statistics' })
    expect(await within(dialog).findByText('50')).toBeTruthy()
    // A guess count the server left out is a zero, not a placeholder that never goes.
    expect(dialog.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)

    app.backend.replies.set(STATS_URL, {
      status: 404,
      data: { status: 404, code: 'game_not_found', request_id: 'r' },
    })
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ['game-stats'] })
      // The query's observers are told on the next tick; the page draws after that.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(figure(dialog, 'Played')).toBe('4')
  })
})
