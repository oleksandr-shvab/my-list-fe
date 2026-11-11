// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameGuesserView, GuessRead } from '@/api/generated/models'
import i18n from '@/i18n'
import {
  gameView,
  GUEST,
  SIGNED_IN,
  startApp,
  type Reply,
} from '@/test/router-harness'

const DAY = '2026-11-05'
const PAGE = `/games/game-guesser/${DAY}`
const VIEW_URL = `/v1/games/game-guesser/puzzles/${DAY}`
const NUDGE = /Nice win! Sign up to keep your streak/

let stop: (() => void) | undefined

function renderPage(
  view: GameGuesserView,
  me: Reply = GUEST,
  { path = PAGE, viewUrl = VIEW_URL } = {},
) {
  const app = startApp({ path, me })
  stop = app.stop
  app.backend.replies.set(viewUrl, { status: 200, data: view })
  const { unmount } = render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return {
    // Closes the page to open it again, as a later visit.
    close() {
      unmount()
      app.stop()
      stop = undefined
    },
  }
}

function guesses(count: number): GuessRead[] {
  return Array.from({ length: count }, (_, index) => ({
    title_id: index + 1,
    name: `Game ${index + 1}`,
    result: 'wrong' as const,
  }))
}

const won = (signedIn: boolean) =>
  gameView({
    date: DAY,
    signed_in: signedIn,
    status: 'won',
    guesses: [...guesses(2), { title_id: 9, name: 'Zelda', result: 'correct' }],
    guesses_used: 3,
    guesses_left: 3,
    answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
  })

const lost = gameView({
  date: DAY,
  signed_in: false,
  status: 'lost',
  guesses: guesses(6),
  guesses_used: 6,
  guesses_left: 0,
  answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
})

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.restoreAllMocks()
})

describe('the sign-up nudge on a guest’s win (AC-90 to AC-94)', () => {
  it('shows with links back to this page, hides on "Not now" and stays hidden on a later win', async () => {
    const user = userEvent.setup()
    const page = renderPage(won(false))

    expect(await screen.findByText(NUDGE)).toBeTruthy()
    for (const [name, path] of [
      ['Sign up', '/register'],
      ['Log in', '/login'],
    ]) {
      // The nudge's own link; the sidebar has links with the same names.
      const link = within(
        screen.getByRole('region', { name: 'Create an account' }),
      ).getByRole('link', { name })
      const url = new URL(
        link.getAttribute('href') ?? '',
        window.location.origin,
      )
      expect(url.pathname).toBe(path)
      expect(url.searchParams.get('redirect')).toBe(PAGE)
    }

    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(NUDGE)).toBeNull()
    // The card had the focus; it goes to the end screen's heading, not the page.
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'You got it!' }),
    )

    // A later win, as another visit: the flag is kept in this browser.
    page.close()
    renderPage(won(false))
    expect(
      await screen.findByRole('heading', { name: 'You got it!' }),
    ).toBeTruthy()
    expect(screen.queryByText(NUDGE)).toBeNull()
  })

  it('sends the player back to the won puzzle’s own page, not to a today address that is open', async () => {
    renderPage(won(false), GUEST, {
      path: '/games/game-guesser',
      viewUrl: '/v1/games/game-guesser/puzzles/today',
    })

    expect(await screen.findByText(NUDGE)).toBeTruthy()
    // After midnight `/games/game-guesser` is another puzzle; the redirect names the day that was won.
    for (const name of ['Sign up', 'Log in']) {
      const link = within(
        screen.getByRole('region', { name: 'Create an account' }),
      ).getByRole('link', { name })
      const url = new URL(
        link.getAttribute('href') ?? '',
        window.location.origin,
      )
      expect(url.searchParams.get('redirect')).toBe(PAGE)
    }
  })

  it('shows again on every guest win until "Not now" is pressed', async () => {
    const page = renderPage(won(false))
    expect(await screen.findByText(NUDGE)).toBeTruthy()

    // Seeing the card is not dismissing it: the next win, in a later visit, shows it again.
    page.close()
    renderPage(won(false))
    expect(await screen.findByText(NUDGE)).toBeTruthy()
  })

  it('does not show to a signed-in player, nor after a loss', async () => {
    const page = renderPage(won(true), SIGNED_IN)
    expect(
      await screen.findByRole('heading', { name: 'You got it!' }),
    ).toBeTruthy()
    expect(screen.queryByText(NUDGE)).toBeNull()

    page.close()
    renderPage(lost)
    expect(
      await screen.findByRole('heading', { name: 'Not this time' }),
    ).toBeTruthy()
    expect(screen.queryByText(NUDGE)).toBeNull()
  })
})
