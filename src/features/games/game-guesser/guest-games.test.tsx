// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GameGuesserView,
  GuessRead,
  StepRead,
} from '@/api/generated/models'
import { signOutLocally } from '@/features/auth/session'
import i18n from '@/i18n'
import {
  readGuestRecord,
  writeGuestRecord,
} from '@/features/games/guest-records'
import {
  gameView,
  GUEST,
  SIGNED_IN,
  startApp,
  type Reply,
} from '@/test/router-harness'

const PUZZLES = '/v1/games/game-guesser/puzzles'
const DAY = '2026-11-05'
const VIEW_URL = `${PUZZLES}/${DAY}`
const GUESS_URL = `${VIEW_URL}/guesses`
const RESUME_URL = `${VIEW_URL}/resume`
const TODAY_URL = `${PUZZLES}/today`
const KEY = { slug: 'game-guesser', variant: 'default', date: DAY }

const DOOM: GuessRead = { title_id: 42, name: 'Doom', result: 'wrong' }
const QUAKE: GuessRead = { title_id: 43, name: 'Quake', result: 'wrong' }
const SKIPPED: GuessRead = { title_id: null, name: null, result: 'skipped' }

let stop: (() => void) | undefined

function renderApp(path: string, me: Reply = GUEST) {
  const app = startApp({ path, me })
  stop = app.stop
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

// A guest's view with the given guesses, one more step open for each.
function view(guesses: GuessRead[] = []): GameGuesserView {
  return gameView({
    date: DAY,
    signed_in: false,
    guesses,
    guesses_used: guesses.length,
    guesses_left: 6 - guesses.length,
  })
}

function stored(guesses: GuessRead[]) {
  writeGuestRecord(KEY, {
    guesses,
    status: 'in_progress',
    counts_for_streak: true,
    daily_proof: null,
  })
}

function clockOf(now: string, today: string): Reply {
  return {
    status: 200,
    data: { now, today, next_reset: '2026-11-07T00:00:00Z' },
  }
}

function imageStep(sig: string): StepRead {
  return {
    step: 1,
    hint: null,
    media: {
      type: 'image',
      width: 640,
      height: 480,
      expires_at: '2099-01-01T00:00:00Z',
      poster: null,
      sources: [
        {
          content_type: 'image/webp',
          url: `/api/v1/media/1.webp?exp=4070908800&sig=${sig}`,
        },
      ],
    },
    source_url: null,
  }
}

function errorReply(status: number, code: string): Reply {
  return { status, data: { status, code, request_id: 'req-g' } }
}

// The shell has a status line of its own before the game's; the game's is the last.
function gameStatus() {
  return within(screen.getByRole('main')).getAllByRole('status').at(-1)
    ?.textContent
}

// jsdom's tab is always visible; a test says what it is and tells the page.
function setTabVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const NOT_VALID = {
  status: 422,
  data: { status: 422, code: 'invalid_guess_history', request_id: 'req-422' },
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(toast, 'info').mockImplementation(() => 1)
})

afterEach(() => {
  delete (document as { visibilityState?: unknown }).visibilityState
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('a guest game that was stored (AC-39)', () => {
  it('opens from resume with the stored guesses and never asks for the empty view', async () => {
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })
    app.backend.replies.set(RESUME_URL, { status: 200, data: view([DOOM]) })

    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(screen.getByText('Doom')).toBeTruthy()
    expect(app.backend.bodiesOf(RESUME_URL)).toEqual([{ previous: [42] }])
    expect(app.backend.count(VIEW_URL)).toBe(0)
  })

  it('on a page with no date, asks for today and then resumes that day, so the empty view is never the one shown', async () => {
    stored([DOOM])
    const app = renderApp('/')
    app.backend.replies.set(TODAY_URL, { status: 200, data: view() })
    app.backend.replies.set(RESUME_URL, { status: 200, data: view([DOOM]) })

    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(
      app.backend.requests.filter((url) => url.startsWith(PUZZLES)),
    ).toEqual([TODAY_URL, RESUME_URL])
    expect(app.backend.count(VIEW_URL)).toBe(0)
  })
})

describe('a guess in a tab that is behind (AC-38, AC-46)', () => {
  it('sends the record as previous, read when sending, and ends with both guesses in the record', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: view([DOOM, SKIPPED]),
    })
    await screen.findByText('6 guesses left')

    // Another tab guessed Doom: this tab's screen does not show it.
    stored([DOOM])
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('4 guesses left')).toBeTruthy()
    expect(app.backend.bodiesOf(GUESS_URL)).toEqual([
      { title_id: null, previous: [42] },
    ])
    expect(readGuestRecord(KEY)?.guesses).toEqual([DOOM, SKIPPED])
  })
})

describe('a stored history the server refuses (AC-42)', () => {
  it('on resume, drops the record, says so once and shows the fresh puzzle', async () => {
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(RESUME_URL, NOT_VALID)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })

    expect(await screen.findByText('6 guesses left')).toBeTruthy()
    expect(readGuestRecord(KEY)).toBeUndefined()
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith(
      'The saved progress for this puzzle was damaged, so it starts again.',
    )
  })

  it('on a guess, drops the record, says so on the status line and shows the fresh puzzle', async () => {
    const user = userEvent.setup()
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(RESUME_URL, { status: 200, data: view([DOOM]) })
    app.backend.replies.set(GUESS_URL, NOT_VALID)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })
    await screen.findByText('5 guesses left')

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('6 guesses left')).toBeTruthy()
    expect(
      screen.getByText(
        'The saved progress for this puzzle was damaged, so it starts again.',
      ),
    ).toBeTruthy()
    expect(readGuestRecord(KEY)).toBeUndefined()
    expect(toast.info).not.toHaveBeenCalled()
  })
})

describe('a page open across 00:00 UTC (AC-47, AC-48)', () => {
  it('says a new day has started when a guess is sent, keeps the puzzle, and sends the guess to its day', async () => {
    const user = userEvent.setup()
    const app = renderApp('/')
    app.backend.replies.set(TODAY_URL, { status: 200, data: view() })
    app.backend.replies.set(GUESS_URL, { status: 200, data: view([QUAKE]) })
    await screen.findByText('6 guesses left')
    expect(screen.queryByText(/A new day has started/)).toBeNull()

    // Midnight passes, and the server's clock says so.
    app.backend.replies.set(
      '/v1/clock',
      clockOf('2026-11-06T00:00:30Z', '2026-11-06'),
    )
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ['clock'] })
    })
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(
      await screen.findByText(/A new day has started \(UTC\)/),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: "Play today's puzzle" }),
    ).toBeTruthy()
    await waitFor(() => expect(app.backend.count(GUESS_URL)).toBe(1))
    expect(screen.getByText('5 guesses left')).toBeTruthy()
    expect(app.backend.count(TODAY_URL)).toBe(1)
  })
})

describe('a guess that says the game is not what the page shows (AC-43, AC-46)', () => {
  it('resumes from the record when there is one, and refetches nothing when there is none', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })
    app.backend.replies.set(RESUME_URL, { status: 200, data: view([DOOM]) })
    const answers = [
      errorReply(422, 'duplicate_guess'),
      errorReply(409, 'puzzle_already_finished'),
    ]
    app.backend.replies.set(GUESS_URL, () => answers.shift() ?? 'network-error')
    await screen.findByText('6 guesses left')

    // No record: the empty view would wipe the screen, so nothing is asked.
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() =>
      expect(gameStatus()).toBe('You have already tried this one.'),
    )
    expect(app.backend.count(VIEW_URL)).toBe(1)
    expect(app.backend.count(RESUME_URL)).toBe(0)
    expect(screen.getByText('6 guesses left')).toBeTruthy()

    // Another tab played Doom: the page catches up from the record, then says what happened.
    stored([DOOM])
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() =>
      expect(gameStatus()).toBe('This puzzle is already finished.'),
    )
    expect(screen.getByText('5 guesses left')).toBeTruthy()
    expect(screen.getByText('Doom')).toBeTruthy()
    expect(app.backend.bodiesOf(RESUME_URL)).toEqual([{ previous: [42] }])
    expect(app.backend.count(VIEW_URL)).toBe(1)
  })
})

describe('signing out on a page that showed an account game (AC-54)', () => {
  it("shows this browser's record, not the account's game, and never stores the account's answer", async () => {
    const user = userEvent.setup()
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    // The account has played Quake on this day.
    app.backend.replies.set(VIEW_URL, {
      status: 200,
      data: { ...view([QUAKE]), signed_in: true },
    })
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: { ...view([QUAKE, SKIPPED]), signed_in: true },
    })
    // The server replays what it is sent.
    const byId = new Map([DOOM, QUAKE].map((guess) => [guess.title_id, guess]))
    app.backend.replies.set(RESUME_URL, (config) => {
      const { previous } = JSON.parse(config.data) as {
        previous: (number | null)[]
      }
      return {
        status: 200,
        data: view(previous.map((id) => byId.get(id) ?? SKIPPED)),
      }
    })
    await screen.findByText('Quake')
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByText('4 guesses left')
    expect(readGuestRecord(KEY)?.guesses).toEqual([DOOM])

    act(() => signOutLocally(app.queryClient))

    expect(await screen.findByText('Doom')).toBeTruthy()
    expect(screen.queryByText('Quake')).toBeNull()
    expect(screen.getByText('5 guesses left')).toBeTruthy()
    expect(app.backend.bodiesOf(RESUME_URL)).toEqual([{ previous: [42] }])
    expect(readGuestRecord(KEY)?.guesses).toEqual([DOOM])
  })
})

describe('a clue refresh in a tab that is behind (AC-24, AC-38)', () => {
  it("resumes with the record's guesses, which are more than the screen shows, and takes that answer", async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(VIEW_URL, {
      status: 200,
      data: { ...view(), steps: [imageStep('a')] },
    })
    app.backend.replies.set(RESUME_URL, {
      status: 200,
      data: { ...view([DOOM]), steps: [imageStep('b')] },
    })
    const image = await screen.findByAltText('Clue 1 of 6')

    // Another tab guessed Doom.
    stored([DOOM])
    fireEvent.error(image)

    await waitFor(() =>
      expect(screen.getByAltText('Clue 1 of 6').getAttribute('src')).toContain(
        'sig=b',
      ),
    )
    expect(app.backend.bodiesOf(RESUME_URL)).toEqual([{ previous: [42] }])
    expect(screen.getByText('5 guesses left')).toBeTruthy()
  })
})

describe('a stored game opened on a later day (AC-40, AC-88)', () => {
  it('keeps counts_for_streak from the record when resume answers null, so no archive marker shows', async () => {
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(RESUME_URL, {
      status: 200,
      data: { ...view([DOOM]), counts_for_streak: null },
    })
    app.backend.replies.set(
      '/v1/clock',
      clockOf('2026-11-06T12:00:00Z', '2026-11-06'),
    )

    await screen.findByText('5 guesses left')
    await waitFor(() => expect(app.backend.count('/v1/clock')).toBe(1))
    // Let the clock's answer reach the screen before looking for what must not be there.
    await act(async () => {})
    expect(screen.queryByText(/Archive puzzle/)).toBeNull()
  })
})

describe('the day changing under an open page (AC-47, AC-48)', () => {
  it("says so when the tab comes back, by the server's clock, and still sends a guess to the page's day", async () => {
    const user = userEvent.setup()
    // The device is a minute before midnight; the server is already past it.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T23:59:00Z'))
    const app = renderApp('/')
    app.backend.replies.set(TODAY_URL, { status: 200, data: view() })
    app.backend.replies.set(GUESS_URL, { status: 200, data: view([QUAKE]) })
    app.backend.replies.set(
      '/v1/clock',
      clockOf('2026-11-06T00:00:30Z', '2026-11-06'),
    )
    await screen.findByText('6 guesses left')
    await waitFor(() => expect(app.backend.count('/v1/clock')).toBe(1))
    await act(async () => {})

    setTabVisibility('hidden')
    expect(screen.queryByText(/A new day has started/)).toBeNull()
    setTabVisibility('visible')

    expect(screen.getByText(/A new day has started \(UTC\)/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: "Play today's puzzle" }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(app.backend.count(GUESS_URL)).toBe(1)
    expect(app.backend.count(TODAY_URL)).toBe(1)
  })

  it('says nothing on a page opened by its date, which is an archive page after midnight', async () => {
    const user = userEvent.setup()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T00:00:30Z'))
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })
    app.backend.replies.set(GUESS_URL, { status: 200, data: view([QUAKE]) })
    await screen.findByText('6 guesses left')

    setTabVisibility('visible')
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(screen.queryByText(/A new day has started/)).toBeNull()
  })
})

const LOST: GuessRead[] = [1, 2, 3, 4, 5, 6].map((id) => ({
  title_id: id,
  name: `Game ${id}`,
  result: 'wrong',
}))

describe('a game another tab lost (AC-43)', () => {
  const lostView = {
    ...view(LOST),
    status: 'lost' as const,
    answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
  }

  it('does not send the guess with six guesses, resumes from the record and keeps it', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })
    app.backend.replies.set(RESUME_URL, { status: 200, data: lostView })
    // Six entries in `previous` are more than a guess may carry.
    app.backend.replies.set(GUESS_URL, errorReply(422, 'invalid_guess_history'))
    await screen.findByText('6 guesses left')

    writeGuestRecord(KEY, {
      guesses: LOST,
      status: 'lost',
      counts_for_streak: true,
      daily_proof: null,
    })
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('The answer: Zelda (1998)')).toBeTruthy()
    expect(app.backend.count(GUESS_URL)).toBe(0)
    expect(app.backend.bodiesOf(RESUME_URL)).toEqual([
      { previous: [1, 2, 3, 4, 5, 6] },
    ])
    expect(readGuestRecord(KEY)?.status).toBe('lost')
    expect(gameStatus()).toBe('This puzzle is already finished.')
  })

  it('keeps the record when the game was lost while the guess was on its way', async () => {
    const user = userEvent.setup()
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(RESUME_URL, (config) => {
      const { previous } = JSON.parse(config.data) as { previous: number[] }
      return {
        status: 200,
        data: previous.length === 6 ? lostView : view([DOOM]),
      }
    })
    app.backend.replies.set(GUESS_URL, () => {
      writeGuestRecord(KEY, {
        guesses: LOST,
        status: 'lost',
        counts_for_streak: true,
        daily_proof: null,
      })
      return errorReply(422, 'invalid_guess_history')
    })
    await screen.findByText('5 guesses left')

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('The answer: Zelda (1998)')).toBeTruthy()
    expect(readGuestRecord(KEY)?.guesses).toEqual(LOST)
    expect(gameStatus()).toBe('This puzzle is already finished.')
    expect(toast.info).not.toHaveBeenCalled()
  })
})

describe('a clock that has not answered (AC-48)', () => {
  it("never lets the device's day say a new day has started", async () => {
    const user = userEvent.setup()
    const app = renderApp('/')
    app.backend.replies.set(TODAY_URL, { status: 200, data: view() })
    app.backend.replies.set(GUESS_URL, { status: 200, data: view([QUAKE]) })
    // The clock call fails (404), so the device's day is the fallback, and it is past midnight.
    await screen.findByText('6 guesses left')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T00:00:30Z'))

    setTabVisibility('visible')
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(screen.queryByText(/A new day has started/)).toBeNull()
  })
})

describe('a stored game on a page with no date, when the resume fails (AC-39)', () => {
  it('shows the failure of the resume, and "Try again" resumes without asking for today again', async () => {
    const user = userEvent.setup()
    stored([DOOM])
    const app = renderApp('/')
    app.backend.replies.set(TODAY_URL, { status: 200, data: view() })
    const answers = [errorReply(403, 'csrf_origin_mismatch')]
    app.backend.replies.set(
      RESUME_URL,
      () => answers.shift() ?? { status: 200, data: view([DOOM]) },
    )

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(app.backend.count(TODAY_URL)).toBe(1)
    expect(app.backend.count(RESUME_URL)).toBe(2)
    expect(app.backend.count(VIEW_URL)).toBe(0)
  })
})

describe('what a guest view keeps when the server sends null (AC-40)', () => {
  it("keeps the record's proof on a view fetched plain, off the puzzle's own day", async () => {
    writeGuestRecord(KEY, {
      guesses: [],
      status: 'in_progress',
      counts_for_streak: null,
      daily_proof: 'kept',
    })
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(VIEW_URL, { status: 200, data: view() })

    await screen.findByText('6 guesses left')

    expect(
      app.queryClient.getQueryData<GameGuesserView>([
        'game-view',
        'game-guesser',
        DAY,
        'guest',
      ])?.daily_proof,
    ).toBe('kept')
  })

  it("keeps the proof of today's view when the stored game comes from resume", async () => {
    stored([DOOM])
    const app = renderApp('/')
    app.backend.replies.set(TODAY_URL, {
      status: 200,
      data: { ...view(), daily_proof: 'from-today' },
    })
    app.backend.replies.set(RESUME_URL, { status: 200, data: view([DOOM]) })

    await screen.findByText('5 guesses left')

    expect(
      app.queryClient.getQueryData<GameGuesserView>([
        'game-view',
        'game-guesser',
        DAY,
        'guest',
      ])?.daily_proof,
    ).toBe('from-today')
    expect(readGuestRecord(KEY)?.daily_proof).toBe('from-today')
  })
})

describe('a duplicate guess when the record is what the screen shows (AC-46)', () => {
  it('does not resume again', async () => {
    const user = userEvent.setup()
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    app.backend.replies.set(RESUME_URL, { status: 200, data: view([DOOM]) })
    app.backend.replies.set(GUESS_URL, errorReply(422, 'duplicate_guess'))
    await screen.findByText('5 guesses left')

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    await waitFor(() =>
      expect(gameStatus()).toBe('You have already tried this one.'),
    )
    expect(app.backend.count(RESUME_URL)).toBe(1)
  })
})

describe('a session that ended before the page asked for today (AC-39)', () => {
  it('resumes the stored game of that day when /today answers as a guest to a page that showed a user', async () => {
    stored([DOOM])
    const app = renderApp('/', SIGNED_IN)
    app.backend.replies.set(TODAY_URL, { status: 200, data: view() })
    app.backend.replies.set(RESUME_URL, { status: 200, data: view([DOOM]) })

    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(app.backend.bodiesOf(RESUME_URL)).toEqual([{ previous: [42] }])
    expect(app.backend.count(VIEW_URL)).toBe(0)
  })
})

describe("an account answer that turns out to be a guest's (AC-52)", () => {
  it('keeps the proof and the streak flag the browser already holds', async () => {
    const user = userEvent.setup()
    writeGuestRecord(KEY, {
      guesses: [DOOM],
      status: 'in_progress',
      counts_for_streak: true,
      daily_proof: 'proof',
    })
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    app.backend.replies.set(VIEW_URL, {
      status: 200,
      data: { ...view([QUAKE]), signed_in: true },
    })
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: view([QUAKE, SKIPPED]),
    })
    await screen.findByText('Quake')

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('4 guesses left')).toBeTruthy()
    expect(readGuestRecord(KEY)).toEqual({
      guesses: [QUAKE, SKIPPED],
      status: 'in_progress',
      counts_for_streak: true,
      daily_proof: 'proof',
    })
  })
})

describe('a 422 for a history another tab has replaced (AC-42, AC-46)', () => {
  it('keeps the record that is there now and resumes it', async () => {
    const user = userEvent.setup()
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    const byId = new Map([DOOM, QUAKE].map((guess) => [guess.title_id, guess]))
    app.backend.replies.set(RESUME_URL, (config) => {
      const { previous } = JSON.parse(config.data) as { previous: number[] }
      return {
        status: 200,
        data: view(previous.map((id) => byId.get(id) ?? SKIPPED)),
      }
    })
    // Another tab guessed Quake while this guess was on its way.
    app.backend.replies.set(GUESS_URL, () => {
      stored([DOOM, QUAKE])
      return errorReply(422, 'invalid_guess_history')
    })
    await screen.findByText('5 guesses left')

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('4 guesses left')).toBeTruthy()
    expect(readGuestRecord(KEY)?.guesses).toEqual([DOOM, QUAKE])
    expect(app.backend.bodiesOf(RESUME_URL).at(-1)).toEqual({
      previous: [42, 43],
    })
    expect(toast.info).not.toHaveBeenCalled()
    expect(gameStatus()).toBe('This game was updated in another tab.')
  })
})

describe('a resume refused for a history another tab has replaced (AC-42)', () => {
  it('keeps the newer record and resumes it once, with no notice', async () => {
    stored([DOOM])
    const app = renderApp(`/games/game-guesser/${DAY}`)
    const byId = new Map([DOOM, QUAKE].map((guess) => [guess.title_id, guess]))
    let calls = 0
    app.backend.replies.set(RESUME_URL, (config) => {
      const { previous } = JSON.parse(config.data) as { previous: number[] }
      if (calls++ === 0) {
        stored([DOOM, QUAKE])
        return errorReply(422, 'invalid_guess_history')
      }
      return {
        status: 200,
        data: view(previous.map((id) => byId.get(id) ?? SKIPPED)),
      }
    })

    expect(await screen.findByText('4 guesses left')).toBeTruthy()
    expect(app.backend.bodiesOf(RESUME_URL)).toEqual([
      { previous: [42] },
      { previous: [42, 43] },
    ])
    expect(readGuestRecord(KEY)?.guesses).toEqual([DOOM, QUAKE])
    expect(app.backend.count(VIEW_URL)).toBe(0)
    expect(toast.info).not.toHaveBeenCalled()
  })
})

describe('a press that sends nothing (AC-48)', () => {
  it('does not say a new day has started when the stored game is over', async () => {
    const user = userEvent.setup()
    const app = renderApp('/')
    app.backend.replies.set(TODAY_URL, { status: 200, data: view() })
    app.backend.replies.set(RESUME_URL, {
      status: 200,
      data: {
        ...view(LOST),
        status: 'lost',
        answer: { title_id: 9, name: 'Zelda', franchise: null, year: 1998 },
      },
    })
    await screen.findByText('6 guesses left')
    app.backend.replies.set(
      '/v1/clock',
      clockOf('2026-11-06T00:00:30Z', '2026-11-06'),
    )
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ['clock'] })
    })
    // Another tab lost the game.
    writeGuestRecord(KEY, {
      guesses: LOST,
      status: 'lost',
      counts_for_streak: true,
      daily_proof: null,
    })

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('The answer: Zelda (1998)')).toBeTruthy()
    expect(app.backend.count(GUESS_URL)).toBe(0)
    expect(screen.queryByText(/A new day has started/)).toBeNull()
  })
})
