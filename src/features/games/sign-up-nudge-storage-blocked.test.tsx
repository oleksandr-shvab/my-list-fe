// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { gameView, GUEST, startApp } from '@/test/router-harness'

const DAY = '2026-11-05'
const VIEW_URL = `/v1/games/game-guesser/puzzles/${DAY}`
const NUDGE = /Nice win! Sign up to keep your streak/

let stop: (() => void) | undefined

// This file has its own module state: a blocked storage sends the flag to memory for good.
beforeEach(async () => {
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(toast, 'info').mockImplementation(() => 1)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
})

afterEach(() => {
  stop?.()
  vi.restoreAllMocks()
})

it('still shows on a guest’s win when storage refuses, and "Not now" hides it for this tab (AC-94)', async () => {
  const user = userEvent.setup()
  const app = startApp({ path: `/games/game-guesser/${DAY}`, me: GUEST })
  stop = app.stop
  app.backend.replies.set(VIEW_URL, {
    status: 200,
    data: gameView({
      date: DAY,
      signed_in: false,
      status: 'won',
      guesses: [{ title_id: 9, name: 'Zelda', result: 'correct' }],
      guesses_used: 1,
      guesses_left: 5,
      answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
    }),
  })
  const { unmount } = render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )

  expect(await screen.findByText(NUDGE)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Not now' }))
  expect(screen.queryByText(NUDGE)).toBeNull()

  // Another visit in the same tab: the flag could not be saved, and the tab remembers it.
  unmount()
  app.stop()
  stop = undefined
  const again = startApp({ path: `/games/game-guesser/${DAY}`, me: GUEST })
  stop = again.stop
  again.backend.replies.set(
    VIEW_URL,
    app.backend.replies.get(VIEW_URL) ?? { status: 404 },
  )
  render(
    <QueryClientProvider client={again.queryClient}>
      <RouterProvider router={again.router} />
    </QueryClientProvider>,
  )
  expect(
    await screen.findByRole('heading', { name: 'You got it!' }),
  ).toBeTruthy()
  expect(screen.queryByText(NUDGE)).toBeNull()
})
