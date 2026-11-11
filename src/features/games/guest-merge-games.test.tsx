// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergeCreate, MergeRead } from '@/api/generated/models'
import i18n from '@/i18n'
import {
  gamesReply,
  GAMES_URL,
  SIGNED_IN,
  startApp,
  type Reply,
} from '@/test/router-harness'
import { readGuestRecord, writeGuestRecord } from './guest-records'

// The real registry holds one game, so the rules that tell games apart need more entries.
vi.mock('./registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./registry')>()
  const [base] = actual.GAMES
  return {
    ...actual,
    GAMES: [
      base,
      { ...base, slug: 'second-game', order: 2, isDefault: false },
      { ...base, slug: 'third-game', order: 3, isDefault: false },
    ],
  }
})

const FIRST = 'game-guesser'
const SECOND = 'second-game'
const THIRD = 'third-game'
const url = (slug: string) => `/v1/games/${slug}/progress/merge`

let stop: (() => void) | undefined

function answer(stored: number): Reply {
  const data: MergeRead = {
    stored,
    already_present: 0,
    rejected: 0,
    daily_unproven: 0,
    rejected_entries: [],
  }
  return { status: 200, data }
}

function play(slug: string, date: string) {
  writeGuestRecord(
    { slug, variant: 'default', date },
    {
      guesses: [{ title_id: 1, name: 'Game 1', result: 'wrong' }],
      status: 'in_progress',
      counts_for_streak: null,
      daily_proof: null,
    },
  )
}

function kept(slug: string, date: string): boolean {
  return readGuestRecord({ slug, variant: 'default', date }) !== undefined
}

// The backend lists the first two games; the registry also holds a third that it does not enable.
function renderApp() {
  const app = startApp({ path: '/profile', me: SIGNED_IN })
  stop = app.stop
  app.backend.replies.set(GAMES_URL, gamesReply(FIRST, SECOND))
  play(FIRST, '2026-11-01')
  play(FIRST, '2026-11-02')
  play(SECOND, '2026-11-03')
  play(THIRD, '2026-11-04')
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(toast, 'success').mockImplementation(() => 1)
  vi.spyOn(toast, 'error').mockImplementation(() => 1)
})

afterEach(async () => {
  stop?.()
  stop = undefined
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('the merge with several games (AC-95 to AC-97)', () => {
  it('sends each known game its own records, leaves a game the server does not list alone, and adds up what was stored', async () => {
    await i18n.changeLanguage('ru')
    const app = renderApp()
    app.backend.replies.set(url(FIRST), answer(2))
    app.backend.replies.set(url(SECOND), answer(3))

    // 2 + 3 stored: Russian "many" for 5, which neither answer's own count would give.
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledExactlyOnceWith(
        'Добавлено 5 игр из этого браузера в ваш аккаунт.',
      ),
    )
    const dates = (slug: string) =>
      (app.backend.bodiesOf(url(slug)) as MergeCreate[]).map((body) =>
        body.entries.map((entry) => entry.date),
      )
    expect(dates(FIRST)).toEqual([['2026-11-01', '2026-11-02']])
    expect(dates(SECOND)).toEqual([['2026-11-03']])
    expect(app.backend.count(url(THIRD))).toBe(0)
    expect(kept(FIRST, '2026-11-01')).toBe(false)
    expect(kept(FIRST, '2026-11-02')).toBe(false)
    expect(kept(SECOND, '2026-11-03')).toBe(false)
    // The browser keeps what the server cannot take, for the day it can.
    expect(kept(THIRD, '2026-11-04')).toBe(true)
  })

  it('keeps the records of a game that was answered when another game fails', async () => {
    const app = renderApp()
    app.backend.replies.set(url(FIRST), answer(2))
    app.backend.replies.set(url(SECOND), {
      status: 500,
      data: { status: 500, code: 'internal_error' },
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(app.backend.count(url(FIRST))).toBe(1)
    expect(kept(FIRST, '2026-11-01')).toBe(true)
    expect(kept(FIRST, '2026-11-02')).toBe(true)
    expect(kept(SECOND, '2026-11-03')).toBe(true)
    expect(toast.success).not.toHaveBeenCalled()
  })
})
