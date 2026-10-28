// @vitest-environment jsdom
import './dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import {
  GUEST,
  ME_URL,
  SERVER_ERROR,
  SIGNED_IN,
  slowReply,
  startApp,
  USER,
  type Reply,
} from './router-harness'

// The real route tree, layout and pages rendered in jsdom, with the fake backend behind the axios
// client. The fixed day makes "today" 2026-10-28 in UTC.

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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
  await i18n.changeLanguage('en')
  // Failed queries are reported through console.error in development.
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
    renderApp('/games/game-guesser/archive', GUEST)

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Archive',
    )
    expect(screen.getByText('The archive is coming soon.')).toBeTruthy()
    await waitFor(() =>
      expect(document.title).toBe('Archive | Daily Game Challenge'),
    )

    await act(() => i18n.changeLanguage('ru'))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Архив')
    await waitFor(() =>
      expect(document.title).toBe('Архив | Daily Game Challenge'),
    )

    // The brand in the sidebar leads to the home page: the default game, today's puzzle.
    await user.click(screen.getByRole('link', { name: 'Daily Game Challenge' }))
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Game Guesser',
    )
    expect(
      await screen.findByText('Загадка на 28 октября 2026 г.'),
    ).toBeTruthy()
    expect(screen.getByText('Эта игра скоро появится.')).toBeTruthy()
    expect(document.title).toBe('Game Guesser | Daily Game Challenge')
  })

  it.each([
    ['/games/nope', 'Unknown game', 'There is no game at this address.'],
    [
      '/games/game-guesser/2026-10-29',
      'No puzzle for this date',
      "Check the date in the address, or play today's puzzle.",
    ],
    ['/lists', 'Page not found', 'This page does not exist or was moved.'],
  ])(
    'shows %s as "not found" inside the layout, with a way back to today',
    async (path, title, text) => {
      const user = userEvent.setup()
      renderApp(path, GUEST)

      expect(
        (await screen.findByRole('heading', { level: 1 })).textContent,
      ).toBe(title)
      expect(screen.getByText(text)).toBeTruthy()
      // The sidebar is still there.
      expect(
        screen.getByRole('link', { name: 'Daily Game Challenge' }),
      ).toBeTruthy()
      await waitFor(() =>
        expect(document.title).toBe('Page not found | Daily Game Challenge'),
      )

      await user.click(
        screen.getByRole('link', { name: "Go to today's puzzle" }),
      )
      expect(
        (await screen.findByText('Puzzle for October 28, 2026')).tagName,
      ).toBe('P')
    },
  )
})

describe('the account area (AC-21, AC-24, AC-32, AC-33)', () => {
  it('holds its place while `/auth/me` is slow, then offers log in and sign up with this page', async () => {
    const late = slowReply()
    renderApp('/games/game-guesser/2026-10-01', late.reply)

    // The game shows before the answer; the account area shows neither guest nor user.
    expect(await screen.findByText('Puzzle for October 1, 2026')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    await act(async () => late.answer(GUEST))

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

    // Public pages show anyway.
    expect(await screen.findByText('Puzzle for October 28, 2026')).toBeTruthy()
    const retry = await screen.findByRole('button', { name: 'Retry' })
    expect(screen.getByText("Couldn't check your sign-in.")).toBeTruthy()

    app.backend.replies.set(ME_URL, SIGNED_IN)
    await user.click(retry)

    expect(await screen.findByText(USER.email)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    app.backend.replies.set('/v1/auth/logout', { status: 204 })
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeTruthy()
    expect(screen.queryByText(USER.email)).toBeNull()
    expect(app.router.state.location.pathname).toBe('/games/game-guesser')
    expect(screen.getByText('Puzzle for October 28, 2026')).toBeTruthy()
  })
})
