// @vitest-environment jsdom
import './dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import {
  gameView,
  GUEST,
  ME_URL,
  SERVER_ERROR,
  SIGNED_IN,
  slowReply,
  startApp,
  USER,
  type Reply,
} from './router-harness'

let stop: (() => void) | undefined

function renderApp(path: string, me: Reply) {
  const app = startApp({ path, me })
  stop = app.stop
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

// The game screen asks the backend for its puzzle; "today" is the server's 2026-10-28.
// The server says `signed_in` as the session is: a view that disagrees would end or start a session.
function servePuzzles(app: ReturnType<typeof renderApp>) {
  const path = '/v1/games/game-guesser/puzzles/'
  // Each day has its own number, as the archive row that links to it says.
  const puzzle =
    (date: string, number = 308) =>
    () => ({
      status: 200,
      data: gameView({
        date,
        number,
        signed_in: app.backend.replies.get(ME_URL) === SIGNED_IN,
      }),
    })
  app.backend.replies.set(`${path}today`, puzzle('2026-10-28'))
  // After the first answer a page asks for its own day, whoever is signed in.
  app.backend.replies.set(`${path}2026-10-28`, puzzle('2026-10-28'))
  app.backend.replies.set(`${path}2026-10-01`, puzzle('2026-10-01', 280))
  app.backend.replies.set(`${path}2026-10-29`, {
    status: 404,
    data: { status: 404, code: 'puzzle_not_found', request_id: 'req-404' },
  })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
  await i18n.changeLanguage('en')
  // Failed queries are logged with console.error in development.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('the game pages in the layout (AC-3, AC-47, AC-48)', () => {
  it('shows the game for today, then follows the language in the page and the tab title', async () => {
    const user = userEvent.setup()
    const app = renderApp('/games/game-guesser/archive', GUEST)
    servePuzzles(app)
    // A guest's item carries no state and no guess count; the day has no record in this browser.
    app.backend.replies.set('/v1/games/game-guesser/archive', {
      status: 200,
      data: {
        items: [
          { date: '2026-10-27', number: 307, state: null, guesses_used: null },
        ],
        next_before: null,
      },
    })

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Archive',
    )
    expect(await screen.findByText('Not played')).toBeTruthy()
    await waitFor(() =>
      expect(document.title).toBe('Archive | Daily Game Challenge'),
    )

    await act(() => i18n.changeLanguage('ru'))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Архив')
    expect(screen.getByText('Не сыграно')).toBeTruthy()
    await waitFor(() =>
      expect(document.title).toBe('Архив | Daily Game Challenge'),
    )

    await user.click(screen.getByRole('link', { name: 'Daily Game Challenge' }))
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Game Guesser',
    )
    expect(await screen.findByText('#308 · 28 октября 2026 г.')).toBeTruthy()
    expect(document.title).toBe('Game Guesser | Daily Game Challenge')
  })

  it('opens a past puzzle from its archive row without a reload, and the archive leads back to today', async () => {
    const user = userEvent.setup()
    const app = renderApp('/games/game-guesser/archive', GUEST)
    servePuzzles(app)
    app.backend.replies.set('/v1/games/game-guesser/archive', {
      status: 200,
      data: {
        items: [
          { date: '2026-10-01', number: 280, state: null, guesses_used: null },
        ],
        next_before: null,
      },
    })
    // A plain click on a link whose default the router did not prevent would load the address.
    let defaultPrevented: boolean | undefined
    const watch = (event: Event) => (defaultPrevented = event.defaultPrevented)
    document.addEventListener('click', watch)

    try {
      await user.click(await screen.findByRole('link', { name: /^#280/ }))
      expect(await screen.findByText('#280 · October 1, 2026')).toBeTruthy()
      expect(defaultPrevented).toBe(true)

      await user.click(screen.getByRole('link', { name: 'Archive' }))
      await user.click(
        await screen.findByRole('link', { name: "Back to today's puzzle" }),
      )
      expect(await screen.findByText('#308 · October 28, 2026')).toBeTruthy()
    } finally {
      document.removeEventListener('click', watch)
    }
  })

  it.each([
    [
      '/games/nope',
      'Unknown game',
      'There is no game at this address.',
      'Page not found',
    ],
    // The backend's 404 is shown by the game screen, so the tab keeps the game's name (AC-7).
    [
      '/games/game-guesser/2026-10-29',
      'No puzzle for this date',
      "Check the date in the address, or play today's puzzle.",
      'Game Guesser',
    ],
    [
      '/lists',
      'Page not found',
      'This page does not exist or was moved.',
      'Page not found',
    ],
  ])(
    'shows %s as "not found" inside the layout, with a way back to today',
    async (path, title, text, tabTitle) => {
      const user = userEvent.setup()
      servePuzzles(renderApp(path, GUEST))

      // The dated page shows its game's heading while the backend answers.
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
          title,
        ),
      )
      expect(screen.getByText(text)).toBeTruthy()
      expect(
        screen.getByRole('link', { name: 'Daily Game Challenge' }),
      ).toBeTruthy()
      await waitFor(() =>
        expect(document.title).toBe(`${tabTitle} | Daily Game Challenge`),
      )

      await user.click(
        screen.getByRole('link', { name: "Go to today's puzzle" }),
      )
      expect((await screen.findByText('#308 · October 28, 2026')).tagName).toBe(
        'P',
      )
    },
  )
})

describe('the account area (AC-21, AC-24, AC-32, AC-33)', () => {
  it('holds its place while `/auth/me` is slow, then offers log in and sign up with this page', async () => {
    const late = slowReply()
    servePuzzles(renderApp('/games/game-guesser/2026-10-01', late.reply))

    // The page is there, but the puzzle waits for the session check (the view is keyed by who plays).
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.queryByText('#280 · October 1, 2026')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    await act(async () => late.answer(GUEST))
    expect(await screen.findByText('#280 · October 1, 2026')).toBeTruthy()

    const page = encodeURIComponent('/games/game-guesser/2026-10-01')
    const logIn = await screen.findByRole('link', { name: 'Log in' })
    expect(logIn.getAttribute('href')).toBe(`/login?redirect=${page}`)
    expect(
      screen.getByRole('link', { name: 'Sign up' }).getAttribute('href'),
    ).toBe(`/register?redirect=${page}`)
  })

  it('offers a retry when the check fails, then shows the user, and log out keeps the page', async () => {
    const user = userEvent.setup()
    const app = renderApp('/games/game-guesser', SERVER_ERROR)
    servePuzzles(app)

    expect(await screen.findByText('#308 · October 28, 2026')).toBeTruthy()
    const retry = await screen.findByRole('button', { name: 'Retry' })
    expect(screen.getByText("Couldn't check your sign-in.")).toBeTruthy()

    app.backend.replies.set(ME_URL, SIGNED_IN)
    await user.click(retry)

    expect(await screen.findByText(USER.email)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    // After a logout the server knows no session: `/auth/me` and the puzzle views say so.
    app.backend.replies.set('/v1/auth/logout', () => {
      app.backend.replies.set(ME_URL, GUEST)
      return { status: 204 }
    })
    await user.click(
      screen.getByRole('button', { name: `Account: ${USER.email}` }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }))

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeTruthy()
    expect(screen.queryByText(USER.email)).toBeNull()
    expect(app.router.state.location.pathname).toBe('/games/game-guesser')
    expect(await screen.findByText('#308 · October 28, 2026')).toBeTruthy()
  })
})
