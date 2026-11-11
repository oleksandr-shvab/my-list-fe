// @vitest-environment jsdom
import '@/test/dom-setup'
import { onlineManager, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuessRead, MergeCreate, MergeRead } from '@/api/generated/models'
import { signOutLocally } from '@/features/auth/session'
import i18n from '@/i18n'
import {
  gameView,
  GAMES_URL,
  GUEST,
  SERVER_ERROR,
  SIGNED_IN,
  USER,
  slowReply,
  startApp,
  type Reply,
} from '@/test/router-harness'
import { MERGE_TIMING } from './guest-merge'
import {
  readGuestRecord,
  readGuestRecords,
  writeGuestRecord,
} from './guest-records'

// The server's limit per request (SPEC-02 AC-62), written out so a change of the app's constant fails here.
const MERGE_CHUNK_SIZE = 500
const SLUG = 'game-guesser'
const MERGE_URL = `/v1/games/${SLUG}/progress/merge`
const SIGNED_OUT = {
  status: 401,
  data: { status: 401, code: 'not_authenticated', request_id: 'req-401' },
}

let stop: (() => void) | undefined

function mergeAnswer(stored: number, more: Partial<MergeRead> = {}): Reply {
  const data: MergeRead = {
    stored,
    already_present: 0,
    rejected: 0,
    daily_unproven: 0,
    rejected_entries: [],
    ...more,
  }
  return { status: 200, data }
}

// A signed-in player's page; the merge is the layout's, so any page runs it.
function renderApp(path = '/profile') {
  const app = startApp({ path, me: SIGNED_IN })
  stop = app.stop
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

// The nth day after 2025-01-01, a real day for any n of these tests.
function dayNumber(n: number): string {
  return new Date(Date.UTC(2025, 0, 1 + n)).toISOString().slice(0, 10)
}

function keyOf(date: string) {
  return { slug: SLUG, variant: 'default', date }
}

// A played day: one wrong guess, the title id is the day's number.
function play(
  n: number,
  extra: {
    counts_for_streak?: boolean | null
    daily_proof?: string | null
  } = {},
) {
  writeGuestRecord(keyOf(dayNumber(n)), {
    guesses: [{ title_id: n + 1, name: `Game ${n}`, result: 'wrong' }],
    status: 'in_progress',
    counts_for_streak: null,
    daily_proof: null,
    ...extra,
  })
}

function sentEntries(app: ReturnType<typeof renderApp>) {
  return (app.backend.bodiesOf(MERGE_URL) as MergeCreate[]).map(
    (body) => body.entries,
  )
}

function remaining(count: number): number {
  return Array.from({ length: count }, (_, n) => n).filter((n) =>
    readGuestRecord(keyOf(dayNumber(n))),
  ).length
}

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(toast, 'success').mockImplementation(() => 1)
  vi.spyOn(toast, 'error').mockImplementation(() => 1)
})

const TIMING = { ...MERGE_TIMING }

afterEach(() => {
  stop?.()
  stop = undefined
  Object.assign(MERGE_TIMING, TIMING)
  onlineManager.setOnline(true)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('moving this browser’s games into the account (AC-95 to AC-99)', () => {
  it('sends 501 records as 500 and 1, one after another, and deletes them only once both are answered', async () => {
    const total = MERGE_CHUNK_SIZE + 1
    for (let n = 0; n < total; n += 1) play(n)
    // The records that tell the entry's two flags apart (AC-95).
    play(0, { counts_for_streak: true, daily_proof: 'proof-0' })
    play(1, { counts_for_streak: false, daily_proof: 'proof-1' })
    const second = slowReply()
    const app = renderApp()
    let call = 0
    app.backend.replies.set(MERGE_URL, () =>
      ++call === 1 ? mergeAnswer(MERGE_CHUNK_SIZE) : second.reply,
    )

    await waitFor(() => expect(app.backend.count(MERGE_URL)).toBe(2))
    // The second request is still open: nothing is deleted yet, and nothing is said.
    expect(remaining(total)).toBe(total)
    expect(toast.success).not.toHaveBeenCalled()

    // Another tab of this browser plays on while the merge runs: that record is no longer what was sent.
    writeGuestRecord(keyOf(dayNumber(5)), {
      guesses: [
        { title_id: 6, name: 'Game 5', result: 'wrong' },
        { title_id: 7, name: 'Game 6', result: 'wrong' },
      ],
      status: 'in_progress',
      counts_for_streak: null,
      daily_proof: null,
    })

    second.answer(mergeAnswer(1))
    await waitFor(() => expect(remaining(total)).toBe(1))
    expect(readGuestRecord(keyOf(dayNumber(5)))?.guesses).toHaveLength(2)
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(
      `Added ${total} games from this browser to your account.`,
    )
    const [first, last] = sentEntries(app)
    expect([first.length, last.length]).toEqual([MERGE_CHUNK_SIZE, 1])
    const byDate = new Map([...first, ...last].map((e) => [e.date, e]))
    expect(byDate.size).toBe(total)
    expect(byDate.get(dayNumber(0))).toEqual({
      date: dayNumber(0),
      variant: 'default',
      guesses: [1],
      played_as_daily: true,
      daily_proof: 'proof-0',
    })
    // Not true is not played as daily; the proof goes along as it was stored.
    expect(byDate.get(dayNumber(1))).toMatchObject({
      played_as_daily: false,
      daily_proof: 'proof-1',
    })
    expect(byDate.get(dayNumber(2))).toMatchObject({
      played_as_daily: false,
      daily_proof: null,
    })
  })

  it('keeps every record and says so when a request fails, and tries again on the next load', async () => {
    const total = MERGE_CHUNK_SIZE + 1
    for (let n = 0; n < total; n += 1) play(n)
    let app = renderApp()
    let call = 0
    app.backend.replies.set(MERGE_URL, () =>
      ++call === 1
        ? mergeAnswer(MERGE_CHUNK_SIZE)
        : { status: 500, data: { status: 500, code: 'internal_error' } },
    )

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        "Couldn't move your games from this browser. We'll try again next time.",
      ),
    )
    // The first chunk was answered 200, and its records are still here.
    expect(remaining(total)).toBe(total)
    expect(toast.success).not.toHaveBeenCalled()

    // A page that opens later in this visit does not send them again (that is for the next load).
    await app.router.navigate({
      to: '/games/$slug/archive',
      params: { slug: SLUG },
    })
    await waitFor(() =>
      expect(app.backend.count(`/v1/games/${SLUG}/archive`)).toBeGreaterThan(0),
    )
    expect(app.backend.count(MERGE_URL)).toBe(2)

    // The next page load: the same games are sent again, and this time all is well.
    app.stop()
    app = renderApp()
    app.backend.replies.set(MERGE_URL, mergeAnswer(0))
    await waitFor(() => expect(remaining(total)).toBe(0))
    expect(app.backend.count(MERGE_URL)).toBe(2)
  })

  it('keeps every record and says nothing when the merge answers 401', async () => {
    for (let n = 0; n < 3; n += 1) play(n)
    const app = renderApp()
    // Without the session guard (a logout is running, say) the page does not react to the 401: what is said and kept is
    // decided by the merge alone.
    app.removeSessionGuard()
    app.backend.replies.set(MERGE_URL, SIGNED_OUT)

    await waitFor(() =>
      expect(
        app.queryClient.getQueryState(['guest-merge', 'user-1'])?.status,
      ).toBe('error'),
    )
    expect(remaining(3)).toBe(3)
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('deletes nothing and says nothing when the session ends while the request is open', async () => {
    for (let n = 0; n < 3; n += 1) play(n)
    const open = slowReply()
    const app = renderApp()
    app.backend.replies.set(MERGE_URL, open.reply)
    await waitFor(() => expect(app.backend.count(MERGE_URL)).toBe(1))

    // The player logs out while the request is open; its answer then comes for an account that is gone.
    signOutLocally(app.queryClient)
    open.answer(mergeAnswer(3))
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(remaining(3)).toBe(3)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('a merge that cannot finish at once', () => {
  it('does not run again on a window focus or a reconnect after it failed', async () => {
    play(0)
    const app = renderApp()
    app.backend.replies.set(MERGE_URL, {
      status: 500,
      data: { status: 500, code: 'internal_error' },
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))

    // A query with no data is stale even with `staleTime: Infinity`: only the options keep it from running again.
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('offline'))
      window.dispatchEvent(new Event('online'))
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(app.backend.count(MERGE_URL)).toBe(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(remaining(1)).toBe(1)
  })

  it('sends the same request again after a 503 and says nothing of the failure', async () => {
    play(0)
    const app = renderApp()
    let call = 0
    app.backend.replies.set(MERGE_URL, () =>
      ++call === 1
        ? {
            status: 503,
            data: { status: 503, code: 'service_unavailable' },
          }
        : mergeAnswer(1),
    )

    await waitFor(() => expect(remaining(1)).toBe(0))
    expect(app.backend.count(MERGE_URL)).toBe(2)
    // The same entries went the second time, and the failure toast never showed.
    expect(sentEntries(app)[1]).toEqual(sentEntries(app)[0])
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(
      'Added 1 game from this browser to your account.',
    )
    expect(toast.error).not.toHaveBeenCalled()
  })
  it('sends nothing, says so once and keeps every record when the server’s games list cannot be had', async () => {
    play(0)
    const app = renderApp()
    // Without the list the registry would be sent: a game the server lacks refuses the whole request, for ever.
    app.backend.replies.set(GAMES_URL, SERVER_ERROR)

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(app.backend.count(MERGE_URL)).toBe(0)
    expect(remaining(1)).toBe(1)
  })

  it('fails a request that gets no answer in time, and the account’s game is asked for anyway', async () => {
    MERGE_TIMING.requestTimeoutMs = 100
    MERGE_TIMING.retryDelaysMs = [50]
    play(0)
    const day = '2026-11-05'
    const app = renderApp(`/games/${SLUG}/${day}`)
    // A request that never answers, but is cancelled when its signal aborts, as a real one is.
    app.backend.replies.set(
      MERGE_URL,
      (config) =>
        new Promise<Reply>((_, reject) => {
          const signal = config.signal as AbortSignal
          signal.addEventListener('abort', () =>
            reject(new AxiosError('canceled', 'ERR_CANCELED', config)),
          )
        }),
    )
    app.backend.replies.set(`/v1/games/${SLUG}/puzzles/${day}`, {
      status: 200,
      data: gameView({ date: day, signed_in: true }),
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    // A stalled request is not sent again like a lost connection, which would only make the wait longer.
    expect(app.backend.count(MERGE_URL)).toBe(1)
    expect(remaining(1)).toBe(1)
    expect(await screen.findByText(/#308/)).toBeTruthy()
  })

  it('does not wait for a connection: offline, the request fails instead of pausing', async () => {
    MERGE_TIMING.retryDelaysMs = []
    play(0)
    // The browser goes offline once the session is known, just before the merge starts.
    const app = startApp({
      path: '/profile',
      me: () => {
        onlineManager.setOnline(false)
        return SIGNED_IN
      },
    })
    stop = app.stop
    app.backend.replies.set(MERGE_URL, 'network-error')
    render(
      <QueryClientProvider client={app.queryClient}>
        <RouterProvider router={app.router} />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(remaining(1)).toBe(1)
  })

  it('stays in the cache after a failure, so nothing in this visit runs it again', async () => {
    play(0)
    const app = renderApp()
    app.backend.replies.set(MERGE_URL, SERVER_ERROR)
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))

    // The player is on a page outside the layout for longer than a query is kept by default.
    vi.useFakeTimers()
    cleanup()
    vi.advanceTimersByTime(10 * 60 * 1000)

    expect(
      app.queryClient.getQueryState(['guest-merge', 'user-1'])?.status,
    ).toBe('error')
  })
})

describe('what is sent for a browser with odd records (AC-45)', () => {
  it('sends the good ones, drops what the server would refuse the whole request for, and still deletes what was sent', async () => {
    play(0, { daily_proof: 'proof-0', counts_for_streak: true })
    // A proof over the server's 100 characters is sent as null: the game still merges.
    play(1, { daily_proof: 'x'.repeat(101), counts_for_streak: true })
    // A variant over 32 characters is no record at all.
    const longVariant = 'v'.repeat(33)
    writeGuestRecord(
      { slug: SLUG, variant: longVariant, date: dayNumber(2) },
      {
        guesses: [{ title_id: 3, name: 'Game 2', result: 'wrong' }],
        status: 'in_progress',
        counts_for_streak: null,
        daily_proof: null,
      },
    )
    const app = renderApp()
    app.backend.replies.set(MERGE_URL, mergeAnswer(2))

    await waitFor(() => expect(remaining(2)).toBe(0))
    const [entries] = sentEntries(app)
    expect(entries.map((e) => [e.date, e.variant, e.daily_proof])).toEqual(
      expect.arrayContaining([
        [dayNumber(0), 'default', 'proof-0'],
        [dayNumber(1), 'default', null],
      ]),
    )
    expect(entries).toHaveLength(2)
    expect(app.backend.count(MERGE_URL)).toBe(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(
      localStorage.getItem(
        `dgc.guest.v1.${SLUG}.${longVariant}.${dayNumber(2)}`,
      ),
    ).not.toBeNull()
  })
})

describe('what the merge says (AC-96, Q6)', () => {
  it('says nothing when nothing was added, never mentions rejected or unproven entries, and says "1 game" in the singular', async () => {
    const said = [
      vi.spyOn(toast, 'warning').mockImplementation(() => 1),
      vi.spyOn(toast, 'info').mockImplementation(() => 1),
      vi.spyOn(toast, 'message').mockImplementation(() => 1),
    ]
    play(0)
    play(1)
    let app = renderApp()
    // Already there, or refused: nothing was added, so nothing is said, and the records still go.
    app.backend.replies.set(
      MERGE_URL,
      mergeAnswer(0, {
        already_present: 1,
        rejected: 1,
        rejected_entries: [
          { code: 'puzzle_not_found', date: dayNumber(1), variant: 'default' },
        ],
      }),
    )
    await waitFor(() => expect(remaining(2)).toBe(0))
    expect(app.backend.count(MERGE_URL)).toBe(1)

    app.stop()
    play(0)
    app = renderApp()
    app.backend.replies.set(MERGE_URL, mergeAnswer(1, { daily_unproven: 1 }))
    await waitFor(() => expect(remaining(1)).toBe(0))
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(
      'Added 1 game from this browser to your account.',
    )
    expect(toast.error).not.toHaveBeenCalled()
    for (const spy of said) expect(spy).not.toHaveBeenCalled()
  })
})

describe('an account with nothing to move', () => {
  it('sends nothing and does not wait for the games list; a record that only keeps a proof stays', async () => {
    // Nothing guessed: the day is not a played one, so it is neither sent nor deleted.
    writeGuestRecord(keyOf(dayNumber(0)), {
      guesses: [],
      status: 'in_progress',
      counts_for_streak: null,
      daily_proof: 'proof-0',
    })
    expect(readGuestRecords(SLUG)).toEqual([])
    const app = renderApp()
    app.backend.replies.set(GAMES_URL, 'never-answers')
    app.backend.replies.set(MERGE_URL, mergeAnswer(1))

    await waitFor(() =>
      expect(
        app.queryClient.getQueryState(['guest-merge', 'user-1'])?.status,
      ).toBe('success'),
    )
    expect(app.backend.count(MERGE_URL)).toBe(0)
    expect(readGuestRecord(keyOf(dayNumber(0)))?.daily_proof).toBe('proof-0')
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe.each([
  ['logs in', '/login', '/v1/auth/login', 'Log in'],
  ['signs up', '/register', '/v1/auth/register', 'Create account'],
])(
  'a guest who %s with games in this browser (AC-54, AC-95, AC-100)',
  (_, page, authUrl, submit) => {
    it('lands on the page they came from with the account’s game, after the games moved and never with the browser’s record', async () => {
      const day = '2026-11-05'
      const gamePage = `/games/${SLUG}/${day}`
      const viewUrl = `/v1/games/${SLUG}/puzzles/${day}`
      writeGuestRecord(keyOf(day), {
        guesses: [{ title_id: 1, name: 'Browser guess', result: 'wrong' }],
        status: 'in_progress',
        counts_for_streak: null,
        daily_proof: null,
      })
      const user = userEvent.setup()
      const app = startApp({
        path: `${page}?redirect=${encodeURIComponent(gamePage)}`,
        me: GUEST,
      })
      stop = app.stop
      app.backend.replies.set(authUrl, { status: 200, data: USER })
      const merge = slowReply()
      app.backend.replies.set(MERGE_URL, merge.reply)
      app.backend.replies.set(viewUrl, {
        status: 200,
        data: gameView({
          date: day,
          guesses: [{ title_id: 2, name: 'Account guess', result: 'wrong' }],
          guesses_used: 1,
          guesses_left: 5,
        }),
      })
      render(
        <QueryClientProvider client={app.queryClient}>
          <RouterProvider router={app.router} />
        </QueryClientProvider>,
      )

      await user.type(await screen.findByLabelText('Email'), USER.email)
      await user.type(screen.getByLabelText('Password'), 'secret-password')
      await user.click(screen.getByRole('button', { name: submit }))

      // The account's game is not asked for while the games move, and the page does not show the browser's record meanwhile.
      await waitFor(() => expect(app.backend.count(MERGE_URL)).toBe(1))
      // The game's code has loaded and shows its placeholder, so a request would already have gone out.
      await waitFor(() =>
        expect(document.querySelector('[aria-busy="true"]')).not.toBeNull(),
      )
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(app.backend.count(viewUrl)).toBe(0)
      expect(screen.queryByText('Browser guess')).toBeNull()
      merge.answer(mergeAnswer(1))

      expect(await screen.findByText('Account guess')).toBeTruthy()
      expect(screen.queryByText('Browser guess')).toBeNull()
      expect(app.router.state.location.pathname).toBe(gamePage)
      expect(readGuestRecord(keyOf(day))).toBeUndefined()
      // The merge came first, and the view was asked for once.
      expect(app.backend.requests.indexOf(MERGE_URL)).toBeGreaterThan(-1)
      expect(app.backend.requests.indexOf(MERGE_URL)).toBeLessThan(
        app.backend.requests.indexOf(viewUrl),
      )
      expect(app.backend.count(viewUrl)).toBe(1)
    })
  },
)

describe('an answer that says the player is signed in, on a guest page (plan question 3)', () => {
  const DOOM: GuessRead = { title_id: 42, name: 'Doom', result: 'wrong' }

  it('is taken as a sign-in: no guest record is written from it, the merge runs first, and the account’s game is asked for after it', async () => {
    const day = '2026-11-05'
    const pages = `/v1/games/${SLUG}/puzzles/${day}`
    const stored = {
      guesses: [DOOM],
      status: 'in_progress' as const,
      counts_for_streak: true,
      daily_proof: 'proof-today',
    }
    writeGuestRecord(keyOf(day), stored)
    // The player logged in in another tab: the first check says guest, the second says the account.
    let checks = 0
    const app = startApp({
      path: `/games/${SLUG}/${day}`,
      me: () => (++checks === 1 ? GUEST : SIGNED_IN),
    })
    stop = app.stop
    const guest = gameView({
      date: day,
      signed_in: false,
      guesses: [DOOM],
      guesses_used: 1,
      guesses_left: 5,
    })
    const skip: GuessRead = { title_id: null, name: null, result: 'skipped' }
    const account = gameView({
      date: day,
      signed_in: true,
      guesses: [DOOM, skip],
      guesses_used: 2,
      guesses_left: 4,
    })
    const merge = slowReply()
    app.backend.replies.set(`${pages}/resume`, { status: 200, data: guest })
    app.backend.replies.set(`${pages}/guesses`, { status: 200, data: account })
    app.backend.replies.set(pages, { status: 200, data: account })
    app.backend.replies.set(MERGE_URL, merge.reply)
    render(
      <QueryClientProvider client={app.queryClient}>
        <RouterProvider router={app.router} />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()
    await screen.findByText('5 guesses left')

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    // The session is asked about again, and the merge sends the record as it was, without the answer's guess.
    await waitFor(() => expect(app.backend.count(MERGE_URL)).toBe(1))
    expect(app.backend.count('/v1/auth/me')).toBe(2)
    expect(sentEntries(app)).toEqual([
      [
        {
          date: day,
          variant: 'default',
          guesses: [42],
          played_as_daily: true,
          daily_proof: 'proof-today',
        },
      ],
    ])
    expect(readGuestRecord(keyOf(day))).toEqual(stored)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(app.backend.count(pages)).toBe(0)

    merge.answer(mergeAnswer(1))
    await waitFor(() => expect(app.backend.count(pages)).toBe(1))
    expect(await screen.findByText('4 guesses left')).toBeTruthy()
    expect(readGuestRecord(keyOf(day))).toBeUndefined()
  })
})

describe('the account’s game waits for the merge (AC-100)', () => {
  it('asks for no view until the merge has answered, then shows the account’s game', async () => {
    play(0)
    const day = '2026-11-05'
    const merge = slowReply()
    const app = renderApp(`/games/${SLUG}/${day}`)
    app.backend.replies.set(MERGE_URL, merge.reply)
    app.backend.replies.set(`/v1/games/${SLUG}/puzzles/${day}`, {
      status: 200,
      data: gameView({ date: day, signed_in: true }),
    })

    await waitFor(() => expect(app.backend.count(MERGE_URL)).toBe(1))
    // The game's code has loaded and shows its placeholder, so a request would already have gone out.
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeNull(),
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(app.backend.count(`/v1/games/${SLUG}/puzzles/${day}`)).toBe(0)

    merge.answer(mergeAnswer(1))
    // The puzzle line of the game, not the placeholder's heading.
    expect(await screen.findByText(/#308/)).toBeTruthy()
    expect(app.backend.count(`/v1/games/${SLUG}/puzzles/${day}`)).toBe(1)
  })
})
