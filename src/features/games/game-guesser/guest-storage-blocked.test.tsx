// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readGuestRecord } from '@/features/games/guest-records'
import i18n from '@/i18n'
import { gameView, GUEST, startApp } from '@/test/router-harness'

const VIEW_URL = '/v1/games/game-guesser/puzzles/2026-11-05'
const GUESS_URL = `${VIEW_URL}/guesses`

let stop: (() => void) | undefined

// This file has its own module state: a blocked storage sends the records to memory for good.
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

describe('browser storage that refuses to save (AC-44)', () => {
  it('keeps the game going in this tab, resends its own record, and shows the notice once', async () => {
    const user = userEvent.setup()
    const app = startApp({ path: '/games/game-guesser/2026-11-05', me: GUEST })
    stop = app.stop
    const guest = (used: number) =>
      gameView({
        date: '2026-11-05',
        signed_in: false,
        guesses_used: used,
        guesses_left: 6 - used,
        guesses: Array.from({ length: used }, () => ({
          title_id: null,
          name: null,
          result: 'skipped' as const,
        })),
      })
    app.backend.replies.set(VIEW_URL, { status: 200, data: guest(0) })
    // The next view has one more skip than the guess list sent.
    app.backend.replies.set(GUESS_URL, (config) => ({
      status: 200,
      data: guest(JSON.parse(config.data).previous.length + 1),
    }))
    render(
      <QueryClientProvider client={app.queryClient}>
        <RouterProvider router={app.router} />
      </QueryClientProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await screen.findByText('5 guesses left')
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByText('4 guesses left')

    expect(app.backend.bodiesOf(GUESS_URL)).toEqual([
      { title_id: null, previous: [] },
      { title_id: null, previous: [null] },
    ])
    // Nothing reached the storage, and the tab still holds both guesses.
    expect(
      readGuestRecord({
        slug: 'game-guesser',
        variant: 'default',
        date: '2026-11-05',
      })?.guesses,
    ).toHaveLength(2)
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith(
      "This browser doesn't let the site save progress. Your game lasts until you close the tab.",
      expect.anything(),
    )
  })
})
