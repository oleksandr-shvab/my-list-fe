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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameGuesserView, StepRead } from '@/api/generated/models'
import i18n from '@/i18n'
import { readGuestRecord } from '@/features/games/guest-records'
import {
  gameView,
  GUEST,
  ME_URL,
  SERVER_ERROR,
  SIGNED_IN,
  slowReply,
  startApp,
  type Reply,
} from '@/test/router-harness'

const PUZZLES = '/v1/games/game-guesser/puzzles'
const DAY = '2026-11-05'
const VIEW_URL = `${PUZZLES}/${DAY}`
const GUESS_URL = `${VIEW_URL}/guesses`

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

const LIVE = '2099-01-01T00:00:00Z'
const EXPIRED = '2020-01-01T00:00:00Z'

// A signed link: the file is the path, the signature is in the query (CONTRACTS, "Clue media").
function step(n: number, sig = 'a', expiresAt = LIVE): StepRead {
  return {
    step: n,
    hint: null,
    media: {
      type: 'image',
      width: 640,
      height: 480,
      expires_at: expiresAt,
      poster: null,
      sources: [
        {
          content_type: 'image/webp',
          url: `/api/v1/media/${n}.webp?exp=4070908800&sig=${sig}`,
        },
      ],
    },
    source_url: null,
  }
}

// The step-6 clip: two sources, the one the browser should try first coming first.
function clip(n: number, sig = 'a'): StepRead {
  const base = step(n, sig)
  return {
    ...base,
    media: {
      ...base.media,
      type: 'video',
      poster: {
        content_type: 'image/webp',
        url: `/api/v1/media/poster-${n}.webp?exp=4070908800&sig=${sig}`,
        expires_at: LIVE,
      },
      sources: [
        {
          content_type: 'video/webm',
          url: `/api/v1/media/${n}.webm?exp=4070908800&sig=${sig}`,
        },
        {
          content_type: 'video/mp4',
          url: `/api/v1/media/${n}.mp4?exp=4070908800&sig=${sig}`,
        },
      ],
    },
  }
}

// jsdom plays nothing: a fake that keeps `paused` and sends the events a browser sends. A load stops the element.
function fakePlayback({ refuseFirstPlay = false } = {}) {
  let paused = true
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(
    () => paused,
  )
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(function (this: HTMLMediaElement) {
      paused = false
      this.dispatchEvent(new Event('play'))
      return Promise.resolve()
    })
  if (refuseFirstPlay) {
    play.mockRejectedValueOnce(new DOMException('refused', 'NotAllowedError'))
  }
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(function (this: HTMLMediaElement) {
      paused = true
      this.dispatchEvent(new Event('pause'))
    })
  const load = vi
    .spyOn(HTMLMediaElement.prototype, 'load')
    .mockImplementation(() => {
      paused = true
    })
  return { play, pause, load }
}

// An account's view that signs its links again with every answer: `a`, then `b`, then `c`...
function signedAgain(
  app: ReturnType<typeof renderApp>,
  stepsOf: (sig: string) => StepRead[],
) {
  let answers = 0
  app.backend.replies.set(VIEW_URL, () => ({
    status: 200,
    data: {
      ...accountView(1),
      steps: stepsOf('abcdef'[answers++]),
    },
  }))
}

function accountView(earned: number): GameGuesserView {
  return { ...view(earned), signed_in: true }
}

const SKIPPED = { title_id: null, name: null, result: 'skipped' } as const

// A guest's game with `earned` steps open: one skip per step after the first. The server says `signed_in`, and a
// guest's view says false: an answer that says true is an account's and never goes under the guest.
function view(earned: number, maxGuesses = 6): GameGuesserView {
  const used = earned - 1
  return gameView({
    date: DAY,
    signed_in: false,
    max_guesses: maxGuesses,
    guesses_used: used,
    guesses_left: maxGuesses - used,
    guesses: Array.from({ length: used }, () => SKIPPED),
    steps: Array.from({ length: earned }, (_, index) => step(index + 1)),
  })
}

function serve(app: ReturnType<typeof renderApp>, data: GameGuesserView) {
  app.backend.replies.set(VIEW_URL, { status: 200, data })
}

beforeEach(async () => {
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

describe('the clue ladder (AC-8, AC-9, AC-12, AC-107)', () => {
  it('takes the number of steps and guesses from the view', async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(1, 5))

    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(5)
  })

  it('skips locked steps with the arrow keys, and gives a locked step no image', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(2, 5))

    const stepTwo = await screen.findByRole('tab', { name: 'Step 2' })
    expect(
      screen
        .getByRole('tab', { name: 'Step 3, locked' })
        .hasAttribute('disabled'),
    ).toBe(true)
    // Two earned steps, two images: the other three have none.
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(2)

    act(() => stepTwo.focus())
    await user.keyboard('{ArrowRight}')

    // From the last earned step the focus wraps to step 1, past the three locked ones.
    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Step 1' }),
    )
  })

  it('keeps the selected step when the language changes', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(3))

    await user.click(await screen.findByRole('tab', { name: 'Step 1' }))
    await act(() => i18n.changeLanguage('ru'))

    const selected = screen.getByRole('tab', { name: 'Шаг 1' })
    expect(selected.getAttribute('aria-selected')).toBe('true')
    expect(
      screen.getByRole('tab', { name: 'Шаг 3' }).getAttribute('aria-selected'),
    ).toBe('false')
  })
})

describe('Skip (AC-16, AC-17, AC-53, AC-110)', () => {
  it('sends one request for a double click, and shows the answer with no second view request', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(1))
    const late = slowReply()
    app.backend.replies.set(GUESS_URL, late.reply)

    await user.dblClick(await screen.findByRole('button', { name: 'Skip' }))
    expect(app.backend.count(GUESS_URL)).toBe(1)

    await act(async () => late.answer({ status: 200, data: view(2) }))

    expect(
      await screen.findByText('Skipped. Step 2 unlocked. 5 guesses left.'),
    ).toBeTruthy()
    expect(screen.getByText('5 guesses left')).toBeTruthy()
    expect(app.backend.count(VIEW_URL)).toBe(1)
  })

  it('for an account, gets the view again after a network error, so a skip the server stored is not sent twice', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    let stored = false
    app.backend.replies.set(VIEW_URL, () => ({
      status: 200,
      data: accountView(stored ? 2 : 1),
    }))
    // The server stores the skip and the answer is lost; the second guess goes through.
    app.backend.replies.set(GUESS_URL, () => {
      if (stored) return { status: 200, data: accountView(3) }
      stored = true
      return 'network-error'
    })

    await user.click(await screen.findByRole('button', { name: 'Skip' }))

    expect(await screen.findByText(/Network error/)).toBeTruthy()
    expect(app.backend.count(VIEW_URL)).toBe(2)
    const list = screen.getByRole('list', { name: 'Your guesses' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('4 guesses left')).toBeTruthy()
    expect(app.backend.bodiesOf(GUESS_URL)).toEqual([
      { title_id: null, previous: [] },
      { title_id: null, previous: [null] },
    ])
  })
})

describe('what the screen asks for and what it cannot show (AC-2 to AC-5, AC-88)', () => {
  it('asks for today on / and takes the date from the answer, even with the device a day ahead', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'))
    const app = renderApp('/', GUEST)
    app.backend.replies.set(`${PUZZLES}/today`, {
      status: 200,
      data: gameView({ date: '2026-10-28' }),
    })
    app.backend.replies.set('/v1/clock', {
      status: 200,
      data: {
        now: '2026-10-28T12:00:00Z',
        today: '2026-10-28',
        next_reset: '2026-10-29T00:00:00Z',
      },
    })

    expect(await screen.findByText('#308 · October 28, 2026')).toBeTruthy()
    expect(app.backend.count(`${PUZZLES}/today`)).toBe(1)
    expect(app.backend.requests.some((url) => url.endsWith('2026-10-29'))).toBe(
      false,
    )
    // By the device's day this would be an archive puzzle; by the server's it is today's.
    expect(screen.queryByText(/Archive puzzle/)).toBeNull()
  })

  it('shows "No puzzle for this date" inside the layout when the backend has none', async () => {
    const app = renderApp('/games/game-guesser/2099-01-01', GUEST)
    app.backend.replies.set(`${PUZZLES}/2099-01-01`, {
      status: 404,
      data: { status: 404, code: 'puzzle_not_found', request_id: 'req-404' },
    })

    expect(await screen.findByText('No puzzle for this date')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Games' })).toBeTruthy()
  })

  it('shows the game error for a view type it does not know, and "Try again" loads the page again', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, {
      ...view(1),
      type: 'movie_guesser',
    } as unknown as GameGuesserView)

    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByRole('navigation', { name: 'Games' })).toBeTruthy()

    await user.click(retry)

    // The same answer would come again; a newer version of the app may know the type.
    expect(reload).toHaveBeenCalledTimes(1)
    expect(app.backend.count(VIEW_URL)).toBe(1)
  })
})

// The shell has a status line of its own (loading) before the game's; the game's is the last.
function guessStatus() {
  return within(screen.getByRole('main')).getAllByRole('status').at(-1)
    ?.textContent
}

function guessErrorReply(status: number, code: string): Reply {
  // `title` is the backend's English text: it must never reach the player (AC-61).
  return {
    status,
    data: { status, code, title: 'Backend English title', request_id: 'req-g' },
  }
}

describe('a guess that fails (AC-57 to AC-59, AC-61, AC-62)', () => {
  it('shows the catalogue text for each failure, sends nothing by itself, and leaves Skip usable', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(1))
    const replies: Reply[] = [
      guessErrorReply(429, 'too_many_requests'),
      guessErrorReply(403, 'csrf_origin_mismatch'),
      guessErrorReply(503, 'service_unavailable'),
      guessErrorReply(500, 'internal_error'),
      'network-error',
    ]
    const texts = [
      'Too many attempts. Please wait a moment and try again.',
      'This request came from an address the site does not accept. Open the site at its usual address and try again.',
      'The service is temporarily unavailable. Please try again soon.',
      'Something went wrong on our side. Please try again.',
      'Network error. Check your connection and try again.',
    ]
    app.backend.replies.set(GUESS_URL, () => replies.shift() ?? SERVER_ERROR)

    await screen.findByRole('button', { name: 'Skip' })
    for (const [index, text] of texts.entries()) {
      await user.click(screen.getByRole('button', { name: 'Skip' }))

      // The message sits in the polite live region (AC-62).
      await waitFor(() => expect(guessStatus()).toBe(text))
      expect(app.backend.count(GUESS_URL)).toBe(index + 1)
      expect(
        screen
          .getByRole('button', { name: 'Skip' })
          .getAttribute('aria-disabled'),
      ).not.toBe('true')
    }
    expect(screen.queryByText(/Backend English title/)).toBeNull()
    // A guest's network error does not ask for the view again (that is for an account).
    expect(app.backend.count(VIEW_URL)).toBe(1)
  })
})

describe('a guess the account answers as a guest (AC-10, AC-17, AC-51)', () => {
  it('keeps the answer for the guest key with no new request, selects the new step, and sends the shown guesses as previous', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    serve(
      app,
      gameView({
        date: DAY,
        guesses_used: 1,
        guesses_left: 5,
        guesses: [{ title_id: 42, name: 'Doom', result: 'wrong' }],
        steps: [step(1), step(2)],
      }),
    )
    // The session ended: the answer says it is a guest's game (R-2).
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: gameView({
        date: DAY,
        signed_in: false,
        guesses_used: 2,
        guesses_left: 4,
        guesses: [{ title_id: 42, name: 'Doom', result: 'wrong' }, SKIPPED],
        steps: [step(1), step(2), step(3)],
      }),
    })

    await user.click(await screen.findByRole('tab', { name: 'Step 1' }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('4 guesses left')).toBeTruthy()
    // The newest step is selected, although the player was looking at step 1 (AC-10).
    expect(
      screen.getByRole('tab', { name: 'Step 3' }).getAttribute('aria-selected'),
    ).toBe('true')
    expect(app.backend.count(VIEW_URL)).toBe(1)
    expect(app.backend.bodiesOf(GUESS_URL)).toEqual([
      { title_id: null, previous: [42] },
    ])
    // From now on the game is this browser's: the record holds the answer's guesses (AC-52).
    expect(
      readGuestRecord({
        slug: 'game-guesser',
        variant: 'default',
        date: DAY,
      })?.guesses,
    ).toEqual([{ title_id: 42, name: 'Doom', result: 'wrong' }, SKIPPED])
  })
})

describe('the clue content (AC-11, AC-19, AC-20)', () => {
  it('labels known hint kinds, gives any other kind the generic label, and reserves the image box', async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    const withHint = (n: number, kind: string, value: string) => ({
      ...step(n),
      hint: { kind, value },
    })
    serve(app, {
      ...view(4),
      steps: [
        withHint(1, 'platform', 'Nintendo 64'),
        withHint(2, 'franchise_rating', 'E'),
        // A name that exists on every object must not count as a known kind.
        withHint(3, 'constructor', 'x'),
        withHint(4, 'critic_score', '90'),
      ],
    })

    await screen.findByRole('tab', { name: 'Step 1' })
    const hints = screen
      .getAllByText((_, element) => element?.tagName === 'P')
      .map((element) => element.textContent)
      .filter((text) => text?.includes(':'))
    expect(hints).toEqual([
      'Platform: Nintendo 64',
      'Hint: E',
      'Hint: x',
      'Critic score: 90',
    ])

    const images = screen.getAllByRole('img', { hidden: true })
    expect(images.map((image) => image.getAttribute('alt'))).toEqual([
      'Clue 1 of 6',
      'Clue 2 of 6',
      'Clue 3 of 6',
      'Clue 4 of 6',
    ])
    expect(images[0].getAttribute('width')).toBe('640')
    expect(images[0].getAttribute('height')).toBe('480')
  })
})

describe('the end of a game (AC-13, AC-18)', () => {
  it('shows the answer only from the finished view, with all steps open and no controls', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(1))
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: gameView({
        date: DAY,
        signed_in: false,
        status: 'won',
        guesses_used: 4,
        guesses_left: 2,
        guesses: [
          { title_id: 1, name: 'Doom', result: 'wrong' },
          { title_id: 2, name: 'Zelda II', result: 'franchise' },
          SKIPPED,
          { title_id: 3, name: 'Zelda', result: 'correct' },
        ],
        steps: [1, 2, 3, 4, 5, 6].map((n) => step(n)),
        answer: { title_id: 3, name: 'Zelda', year: 1998, franchise: null },
      }),
    })

    await user.click(await screen.findByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('The answer: Zelda (1998)')).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Your guesses' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['DoomWrong', 'Zelda IIRight series', 'Skipped', 'ZeldaCorrect'])
    // A finished game is announced by its result alone: no step is left to unlock.
    expect(guessStatus()).toBe('Correct')
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(
      screen.getAllByRole('tab').some((tab) => tab.hasAttribute('disabled')),
    ).toBe(false)
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(screen.queryByText(/guesses? left/)).toBeNull()
  })

  it('shows no answer while the game is in progress', async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(2))

    await screen.findByText('5 guesses left')
    expect(screen.queryByText(/The answer/)).toBeNull()
  })
})

describe('the archive marker (AC-88)', () => {
  it('shows it when the server says the puzzle is before today', async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(1))
    app.backend.replies.set('/v1/clock', {
      status: 200,
      data: {
        now: '2026-11-06T12:00:00Z',
        today: '2026-11-06',
        next_reset: '2026-11-07T00:00:00Z',
      },
    })

    expect(await screen.findByText(/Archive puzzle/)).toBeTruthy()
  })

  it("shows nothing on the server's today, after the clock has answered", async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(1))
    app.backend.replies.set('/v1/clock', {
      status: 200,
      data: {
        now: '2026-11-05T12:00:00Z',
        today: DAY,
        next_reset: '2026-11-06T00:00:00Z',
      },
    })

    await screen.findByText('6 guesses left')
    await waitFor(() => expect(app.backend.count('/v1/clock')).toBe(1))
    // Let the answer reach the screen before looking for what must not be there.
    await act(async () => {})
    expect(screen.queryByText(/Archive puzzle/)).toBeNull()
  })
})

describe('guesses left in Russian (AC-14)', () => {
  it('uses the right plural form', () => {
    const left = (count: number) =>
      i18n.t('games.guesses_left', { count, lng: 'ru' })

    expect([1, 2, 5, 21].map(left)).toEqual([
      'Осталась 1 попытка',
      'Осталось 2 попытки',
      'Осталось 5 попыток',
      'Осталась 21 попытка',
    ])
  })
})

const TODAY_URL = `${PUZZLES}/today`
const NEXT_DAY = '2026-11-06'

function goTo(
  app: ReturnType<typeof renderApp>,
  to: '/' | 'archive' | 'dated',
) {
  const slug = 'game-guesser'
  return act(() =>
    to === '/'
      ? app.router.navigate({ to: '/' })
      : to === 'archive'
        ? app.router.navigate({
            to: '/games/$slug/archive',
            params: { slug },
          })
        : app.router.navigate({
            to: '/games/$slug/$date',
            params: { slug, date: DAY },
          }),
  )
}

describe('a page without a date in its address (AC-2, AC-47, AC-49)', () => {
  it('keeps the day of its first answer when the view is fetched again after midnight', async () => {
    const user = userEvent.setup()
    const app = renderApp('/', SIGNED_IN)
    app.backend.replies.set(TODAY_URL, { status: 200, data: accountView(1) })
    serve(app, accountView(1))
    app.backend.replies.set(GUESS_URL, 'network-error')
    await screen.findByText('#308 · November 5, 2026')

    // Midnight passes: "today" is now another puzzle.
    app.backend.replies.set(TODAY_URL, {
      status: 200,
      data: { ...accountView(1), date: NEXT_DAY, number: 309 },
    })
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    // The refetch after the network error asks for the page's own day, not for "today".
    expect(await screen.findByText(/Network error/)).toBeTruthy()
    expect(app.backend.count(VIEW_URL)).toBe(1)
    expect(app.backend.count(TODAY_URL)).toBe(1)
    expect(screen.getByText('#308 · November 5, 2026')).toBeTruthy()
  })

  it('shows one game for / and for the same day by its date', async () => {
    const user = userEvent.setup()
    const app = renderApp('/', GUEST)
    app.backend.replies.set(TODAY_URL, { status: 200, data: view(1) })
    app.backend.replies.set(GUESS_URL, { status: 200, data: view(2) })
    serve(app, view(1))

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await screen.findByText('5 guesses left')
    await goTo(app, 'dated')

    // The same cached game: no stale "6 guesses left", and no request of its own.
    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    expect(app.backend.count(VIEW_URL)).toBe(0)
  })

  it("does not show yesterday's cached puzzle when / is opened again after midnight", async () => {
    const app = renderApp('/', GUEST)
    app.backend.replies.set(TODAY_URL, { status: 200, data: view(1) })
    expect(await screen.findByText('#308 · November 5, 2026')).toBeTruthy()

    await goTo(app, 'archive')
    app.backend.replies.set(TODAY_URL, {
      status: 200,
      data: { ...view(1), date: NEXT_DAY, number: 309 },
    })
    await goTo(app, '/')

    expect(await screen.findByText('#309 · November 6, 2026')).toBeTruthy()
  })

  it('says there is no puzzle today, without a link back to the same page', async () => {
    const app = renderApp('/', GUEST)
    app.backend.replies.set(TODAY_URL, {
      status: 404,
      data: { status: 404, code: 'puzzle_not_found', request_id: 'req-404' },
    })

    expect(await screen.findByText('No puzzle today')).toBeTruthy()
    expect(
      screen.queryByRole('link', { name: "Go to today's puzzle" }),
    ).toBeNull()
  })
})

describe('what the server says decides, not what the page thinks (AC-53)', () => {
  it('with a failed session check, shows every answer, keeps account views out of the guest key, and asks who is signed in', async () => {
    const user = userEvent.setup()
    // The cookie is valid but `/auth/me` is down: the page cannot call this viewer a guest.
    const app = renderApp(`/games/game-guesser/${DAY}`, SERVER_ERROR)
    serve(app, accountView(1))
    const replies: Reply[] = [
      'network-error',
      { status: 200, data: accountView(2) },
    ]
    app.backend.replies.set(GUESS_URL, () => replies.shift() ?? SERVER_ERROR)

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(await screen.findByText(/Network error/)).toBeTruthy()
    // The server says this is an account's game, so the view is asked for again (AC-53).
    expect(app.backend.count(VIEW_URL)).toBe(2)
    const checks = app.backend.count(ME_URL)

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    // The board moves although `/auth/me` stays down, and the page asks who is signed in.
    expect(await screen.findByText('5 guesses left')).toBeTruthy()
    await waitFor(() =>
      expect(app.backend.count(ME_URL)).toBeGreaterThan(checks),
    )
    const viewers = app.queryClient
      .getQueryCache()
      .findAll({ queryKey: ['game-view'] })
      .map((query) => query.queryKey[3])
    expect(viewers).toEqual(['unconfirmed'])
  })

  it.each([
    ['puzzle_already_finished', 409, 'This puzzle is already finished.'],
    ['duplicate_guess', 422, 'You have already tried this one.'],
  ])(
    'for an account, shows the game as the server has it after %s',
    async (code, status, text) => {
      const user = userEvent.setup()
      const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
      let finished = false
      app.backend.replies.set(VIEW_URL, () => ({
        status: 200,
        data: finished
          ? {
              ...accountView(1),
              status: 'won',
              answer: {
                title_id: 3,
                name: 'Zelda',
                year: 1998,
                franchise: null,
              },
            }
          : accountView(1),
      }))
      // Another tab finished the game meanwhile.
      app.backend.replies.set(GUESS_URL, () => {
        finished = true
        return guessErrorReply(status, code)
      })

      await user.click(await screen.findByRole('button', { name: 'Skip' }))

      expect(await screen.findByText('The answer: Zelda (1998)')).toBeTruthy()
      expect(guessStatus()).toBe(text)
      expect(app.backend.count(VIEW_URL)).toBe(2)
    },
  )
})

describe('a clue that does not load (AC-19, AC-24, AC-25)', () => {
  it('for a guest, asks to resume with the shown guesses, then ends the loading state and says so', async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(1))

    const [image] = await screen.findAllByRole('img')
    fireEvent.error(image)

    expect(await screen.findByText("The clue didn't load.")).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(app.backend.bodiesOf(`${VIEW_URL}/resume`)).toEqual([
      { previous: [] },
    ])
  })

  it('asks for the view once, keeps the selected step, and after a second failure shows the message and asks no more', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    // Every answer signs the links again.
    let signed = 0
    app.backend.replies.set(VIEW_URL, () => {
      const sig = signed++ === 0 ? 'a' : 'b'
      return {
        status: 200,
        data: {
          ...accountView(3),
          steps: [1, 2, 3].map((n) => step(n, sig)),
        },
      }
    })

    await user.click(await screen.findByRole('tab', { name: 'Step 2' }))
    fireEvent.error(screen.getByAltText('Clue 2 of 6'))

    await waitFor(() =>
      expect(screen.getByAltText('Clue 2 of 6').getAttribute('src')).toContain(
        'sig=b',
      ),
    )
    expect(app.backend.count(VIEW_URL)).toBe(2)
    expect(
      screen.getByRole('tab', { name: 'Step 2' }).getAttribute('aria-selected'),
    ).toBe('true')

    fireEvent.error(screen.getByAltText('Clue 2 of 6'))

    expect(screen.getByText("The clue didn't load.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(app.backend.count(VIEW_URL)).toBe(2)
  })
})

describe('fresh links for a clue that failed (AC-24, AC-25)', () => {
  it('for an account, asks once for an image and a clip that fail together, and when the new links are the same ones shows the failure, with "Try again" asking once more', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    // The server signs the same links again: the file is gone, not the signature.
    serve(app, { ...accountView(2), steps: [step(1), clip(2)] })
    await screen.findByAltText('Clue 1 of 6')
    const mp4 = document.querySelector('source[type="video/mp4"]')!

    // The two steps fail together and share one request.
    fireEvent.error(screen.getByAltText('Clue 1 of 6'))
    fireEvent.error(mp4)
    await waitFor(() =>
      expect(screen.getAllByText("The clue didn't load.")).toHaveLength(2),
    )
    expect(app.backend.count(VIEW_URL)).toBe(2)
    // An account's game is on the server: its view is fetched again, never resumed.
    expect(app.backend.count(`${VIEW_URL}/resume`)).toBe(0)

    // The same links again: the image is put back to try them, so only the clip still shows the failure.
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0])
    await waitFor(() => expect(app.backend.count(VIEW_URL)).toBe(3))
    await waitFor(() =>
      expect(screen.getAllByText("The clue didn't load.")).toHaveLength(1),
    )
  })

  it('for a guest, resumes with the shown guesses, and takes the links of the answer', async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, {
      ...view(2),
      guesses: [{ title_id: 42, name: 'Doom', result: 'wrong' }],
      steps: [step(1), step(2)],
    })
    app.backend.replies.set(`${VIEW_URL}/resume`, {
      status: 200,
      data: { ...view(2), steps: [step(1, 'b'), step(2, 'b')] },
    })

    fireEvent.error(await screen.findByAltText('Clue 1 of 6'))

    await waitFor(() =>
      expect(screen.getByAltText('Clue 1 of 6').getAttribute('src')).toContain(
        'sig=b',
      ),
    )
    expect(app.backend.bodiesOf(`${VIEW_URL}/resume`)).toEqual([
      { previous: [42] },
    ])
    // A guest's dated view would come back empty: it is not asked for again.
    expect(app.backend.count(VIEW_URL)).toBe(1)
  })

  it('drops the resume answer when a guess was answered meanwhile', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, view(2))
    const late = slowReply()
    app.backend.replies.set(`${VIEW_URL}/resume`, late.reply)
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: { ...view(3), steps: [1, 2, 3].map((n) => step(n, 'b')) },
    })

    fireEvent.error(await screen.findByAltText('Clue 1 of 6'))
    await waitFor(() => expect(app.backend.count(`${VIEW_URL}/resume`)).toBe(1))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByAltText('Clue 3 of 6')

    // The answer to the older request arrives last, with two steps and other links.
    late.answer({
      status: 200,
      data: { ...view(2), steps: [step(1, 'c'), step(2, 'c')] },
    })
    // Let the answer travel through the client before looking.
    await act(() => new Promise((done) => setTimeout(done, 20)))

    expect(screen.getByText('4 guesses left')).toBeTruthy()
    expect(screen.getByAltText('Clue 3 of 6').getAttribute('src')).toContain(
      'sig=b',
    )
    expect(screen.getByAltText('Clue 1 of 6').getAttribute('src')).toContain(
      'sig=b',
    )
  })
})

describe('the step-6 clip (AC-21, AC-23)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not start by itself when the system asks for reduced motion, and shows the play control', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, { ...view(1), steps: [clip(1)] })

    expect(
      await screen.findByRole('button', { name: 'Play clip' }),
    ).toBeTruthy()
    expect(play).not.toHaveBeenCalled()
  })
})

describe('the step-6 clip controls (AC-21 to AC-23)', () => {
  it('is muted, looping and inline with its sources in order, and when the browser refuses to start it keeps the poster and a play control with no error', async () => {
    const user = userEvent.setup()
    const { play } = fakePlayback({ refuseFirstPlay: true })
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, { ...view(1), steps: [clip(1)] })

    const start = await screen.findByRole('button', { name: 'Play clip' })
    const video = document.querySelector('video')!
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(
      Array.from(video.querySelectorAll('source')).map((source) => [
        source.getAttribute('type'),
        source.getAttribute('src'),
      ]),
    ).toEqual([
      ['video/webm', '/api/v1/media/1.webm?exp=4070908800&sig=a'],
      ['video/mp4', '/api/v1/media/1.mp4?exp=4070908800&sig=a'],
    ])
    // The start by itself was refused (AC-23): the poster stays, and nothing says it went wrong.
    expect(play).toHaveBeenCalledTimes(1)
    expect(video.getAttribute('poster')).toContain('poster-1.webp')
    expect(screen.queryByText("The clue didn't load.")).toBeNull()

    await user.click(start)
    await user.click(await screen.findByRole('button', { name: 'Pause clip' }))

    expect(screen.getByRole('button', { name: 'Play clip' })).toBeTruthy()
    expect(play).toHaveBeenCalledTimes(2)
  })
})

describe('which puzzles are archive puzzles (AC-47, AC-88)', () => {
  const clockOf = (today: string): Reply => ({
    status: 200,
    data: {
      now: `${today}T12:00:00Z`,
      today,
      next_reset: `${today}T23:59:59Z`,
    },
  })

  it.each([
    [
      'a game begun before midnight still counts',
      true,
      clockOf(NEXT_DAY),
      DAY,
      false,
    ],
    [
      'a game that counts for nothing is an archive one',
      false,
      undefined,
      DAY,
      true,
    ],
    ['the device clock alone decides nothing', null, undefined, DAY, false],
    [
      'a page opened as today keeps being today',
      null,
      clockOf(NEXT_DAY),
      'today',
      false,
    ],
  ])('%s', async (_name, counts, clock, page, marker) => {
    const app = renderApp(
      page === 'today' ? '/' : `/games/game-guesser/${page}`,
      GUEST,
    )
    const data = { ...view(1), counts_for_streak: counts }
    app.backend.replies.set(page === 'today' ? TODAY_URL : VIEW_URL, {
      status: 200,
      data,
    })
    if (clock) app.backend.replies.set('/v1/clock', clock)

    await screen.findByText('6 guesses left')
    await waitFor(() => expect(app.backend.count('/v1/clock')).toBe(1))
    // Let the clock's answer, or its failure, reach the screen before looking.
    await act(async () => {})

    expect(screen.queryByText(/Archive puzzle/) !== null).toBe(marker)
  })
})

describe('a visit to the page you are on (AC-47)', () => {
  it('asks for today again when the player follows a link to the same page after midnight', async () => {
    const user = userEvent.setup()
    const app = renderApp('/games/game-guesser', GUEST)
    app.backend.replies.set(TODAY_URL, { status: 200, data: view(1) })
    await screen.findByText('#308 · November 5, 2026')

    app.backend.replies.set(TODAY_URL, {
      status: 200,
      data: { ...view(1), date: NEXT_DAY, number: 309 },
    })
    await user.click(
      within(screen.getByRole('navigation', { name: 'Games' })).getByRole(
        'link',
        { name: 'Game Guesser' },
      ),
    )

    expect(await screen.findByText('#309 · November 6, 2026')).toBeTruthy()
  })
})

describe('clue links that every guess signs again', () => {
  const srcOf = (n: number) =>
    screen.getByAltText(`Clue ${n} of 6`).getAttribute('src')

  it('keeps a link that works and replaces one that expired or failed', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, {
      ...view(3),
      steps: [step(1), step(2, 'a', EXPIRED), step(3)],
    })
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: { ...view(4), steps: [1, 2, 3, 4].map((n) => step(n, 'b')) },
    })
    await screen.findByAltText('Clue 3 of 6')
    fireEvent.error(screen.getByAltText('Clue 3 of 6'))

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByAltText('Clue 4 of 6')

    // Step 1: same file, still valid, so the browser keeps what it has.
    expect(srcOf(1)).toContain('sig=a')
    // Step 2 expired and step 3 failed: both take the new link. Step 4 is new.
    expect(srcOf(2)).toContain('sig=b')
    expect(srcOf(3)).toContain('sig=b')
    expect(srcOf(4)).toContain('sig=b')
  })
})

describe('a clip and its links that stop working (AC-24)', () => {
  const failedMessage = "The clue didn't load."

  it('asks for nothing when the first source fails and the next one may play', async () => {
    fakePlayback()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    serve(app, { ...accountView(1), steps: [clip(1)] })
    await screen.findByRole('button', { name: 'Pause clip' })

    fireEvent.error(document.querySelector('source[type="video/webm"]')!)
    // Let a request, if there were one, travel before looking.
    await act(() => new Promise((done) => setTimeout(done, 20)))

    expect(app.backend.count(VIEW_URL)).toBe(1)
    expect(screen.queryByText(failedMessage)).toBeNull()
  })

  it('swaps in the new links of a clip that stopped while it plays, with no failure shown, the same element and still playing', async () => {
    const { play, load } = fakePlayback()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    signedAgain(app, (sig) => [clip(1, sig)])
    await screen.findByRole('button', { name: 'Pause clip' })
    const video = document.querySelector('video')!

    fireEvent.error(video)

    await waitFor(() =>
      expect(
        video.querySelector('source[type="video/mp4"]')!.getAttribute('src'),
      ).toContain('sig=b'),
    )
    expect(screen.queryByText(failedMessage)).toBeNull()
    expect(document.querySelector('video')).toBe(video)
    expect(load).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Pause clip' })).toBeTruthy()
  })

  it('starts a clip by itself once new links replace ones that never loaded', async () => {
    const { play } = fakePlayback({ refuseFirstPlay: true })
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    signedAgain(app, (sig) => [clip(1, sig)])
    await screen.findByRole('button', { name: 'Play clip' })

    fireEvent.error(document.querySelector('source[type="video/mp4"]')!)

    expect(
      await screen.findByRole('button', { name: 'Pause clip' }),
    ).toBeTruthy()
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('takes only a new poster when the poster fails, and drops the poster when that fails too, with the clip left alone', async () => {
    const { load } = fakePlayback()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    signedAgain(app, (sig) => [clip(1, sig)])
    await screen.findByRole('button', { name: 'Pause clip' })
    const video = document.querySelector('video')!
    const poster = () => document.querySelector('img[alt=""]')!

    fireEvent.error(poster())

    await waitFor(() => expect(video.getAttribute('poster')).toContain('sig=b'))
    expect(
      video.querySelector('source[type="video/mp4"]')!.getAttribute('src'),
    ).toContain('sig=a')
    expect(load).not.toHaveBeenCalled()

    fireEvent.error(poster())

    await waitFor(() => expect(video.hasAttribute('poster')).toBe(false))
    expect(app.backend.count(VIEW_URL)).toBe(2)
    expect(screen.queryByText(failedMessage)).toBeNull()
    expect(screen.getByRole('button', { name: 'Pause clip' })).toBeTruthy()
  })

  it('takes the new poster of a guess when the old one ran out, without touching the clip', async () => {
    fakePlayback()
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    const old = clip(1)
    old.media.poster!.expires_at = EXPIRED
    serve(app, { ...accountView(1), steps: [old] })
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: { ...accountView(2), steps: [clip(1, 'b'), step(2, 'b')] },
    })

    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await screen.findByAltText('Clue 2 of 6')

    const video = document.querySelector('video')!
    expect(video.getAttribute('poster')).toContain('sig=b')
    expect(
      video.querySelector('source[type="video/mp4"]')!.getAttribute('src'),
    ).toContain('sig=a')
  })
})

describe('"Try again" and new link sets (AC-24, AC-25)', () => {
  it('shows the loading state, not the dead image, while the links are asked for, and then lets the image load', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    // The server signs the same links again, so the first failure is final.
    serve(app, { ...accountView(1), steps: [step(1)] })
    fireEvent.error(await screen.findByAltText('Clue 1 of 6'))
    await screen.findByText("The clue didn't load.")
    const late = slowReply()
    app.backend.replies.set(VIEW_URL, late.reply)

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText("The clue didn't load.")).toBeNull()
    await act(async () =>
      late.answer({
        status: 200,
        data: { ...accountView(1), steps: [step(1)] },
      }),
    )
    fireEvent.load(await screen.findByRole('img'))
    expect(screen.queryByText("The clue didn't load.")).toBeNull()
  })

  it('asks again for a link a guess brought in place of the links asked for before', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    // The links asked for have run out, so the guess's set replaces them.
    signedAgain(app, (sig) => [step(1, sig, sig === 'a' ? LIVE : EXPIRED)])
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: { ...accountView(2), steps: [step(1, 'x'), step(2, 'x')] },
    })
    fireEvent.error(await screen.findByAltText('Clue 1 of 6'))
    await waitFor(() => expect(app.backend.count(VIEW_URL)).toBe(2))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByAltText('Clue 2 of 6')

    // The guess's link is a new one: it gets its own request if it fails.
    fireEvent.error(screen.getByAltText('Clue 1 of 6'))

    await waitFor(() => expect(app.backend.count(VIEW_URL)).toBe(3))
    expect(screen.queryByText("The clue didn't load.")).toBeNull()
  })

  it('keeps the links asked for on trial when a guess leaves them in place, so a second failure is final', async () => {
    const user = userEvent.setup()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    signedAgain(app, (sig) => [step(1, sig)])
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: { ...accountView(2), steps: [step(1, 'x'), step(2, 'x')] },
    })
    fireEvent.error(await screen.findByAltText('Clue 1 of 6'))
    await waitFor(() => expect(app.backend.count(VIEW_URL)).toBe(2))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByAltText('Clue 2 of 6')

    // The guess's link is the same file and still good: the shown one stays, and it is the one asked for.
    fireEvent.error(screen.getByAltText('Clue 1 of 6'))

    expect(screen.getByText("The clue didn't load.")).toBeTruthy()
    expect(app.backend.count(VIEW_URL)).toBe(2)
  })
})

describe('a clip on a step that is not shown (AC-22, AC-24)', () => {
  it('pauses, takes a failure only when its step is opened, and plays again when shown', async () => {
    const user = userEvent.setup()
    const { play, pause } = fakePlayback()
    const app = renderApp(`/games/game-guesser/${DAY}`, SIGNED_IN)
    serve(app, { ...accountView(2), steps: [step(1), clip(2)] })
    await screen.findByRole('button', { name: 'Pause clip' })

    await user.click(screen.getByRole('tab', { name: 'Step 1' }))

    expect(pause).toHaveBeenCalledTimes(1)
    fireEvent.error(document.querySelector('video')!)
    await act(() => new Promise((done) => setTimeout(done, 20)))
    expect(app.backend.count(VIEW_URL)).toBe(1)

    await user.click(screen.getByRole('tab', { name: 'Step 2' }))

    expect(play).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(app.backend.count(VIEW_URL)).toBe(2))
  })
})

describe('the loading state of a clip (AC-19)', () => {
  const skeleton = () => document.querySelector('[data-slot="skeleton"]')

  it('lasts until the first frame is there, not until the metadata is', async () => {
    fakePlayback()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, { ...view(1), steps: [clip(1)] })
    await screen.findByRole('button', { name: 'Pause clip' })
    const video = document.querySelector('video')!

    fireEvent.loadedMetadata(video)
    expect(skeleton()).toBeTruthy()

    fireEvent.loadedData(video)
    expect(skeleton()).toBeNull()
  })

  it('ends when the poster has loaded', async () => {
    fakePlayback()
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, { ...view(1), steps: [clip(1)] })
    await screen.findByRole('button', { name: 'Pause clip' })
    expect(skeleton()).toBeTruthy()

    fireEvent.load(document.querySelector('img[alt=""]')!)

    expect(skeleton()).toBeNull()
  })
})

describe('what a guest keeps when links are asked for (AC-40)', () => {
  it('shows no archive marker after a resume answered counts_for_streak with null', async () => {
    const app = renderApp(`/games/game-guesser/${DAY}`, GUEST)
    serve(app, { ...view(1), counts_for_streak: true })
    app.backend.replies.set(`${VIEW_URL}/resume`, {
      status: 200,
      data: { ...view(1), counts_for_streak: null, steps: [step(1, 'b')] },
    })
    app.backend.replies.set('/v1/clock', {
      status: 200,
      data: {
        now: '2026-11-06T12:00:00Z',
        today: '2026-11-06',
        next_reset: '2026-11-07T00:00:00Z',
      },
    })
    const image = await screen.findByAltText('Clue 1 of 6')
    await waitFor(() => expect(app.backend.count('/v1/clock')).toBe(1))

    fireEvent.error(image)

    await waitFor(() =>
      expect(screen.getByAltText('Clue 1 of 6').getAttribute('src')).toContain(
        'sig=b',
      ),
    )
    expect(screen.queryByText(/Archive puzzle/)).toBeNull()
  })
})
