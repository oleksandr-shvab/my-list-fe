import './browser-stubs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { meQueryOptions } from '@/features/auth/queries'
import { onAuthSuccess } from '@/features/auth/mutations'
import {
  finishLogout,
  finishPasswordReset,
  getSessionEpoch,
  signOutLocally,
} from '@/features/auth/session'
import { gamesGetPuzzle } from '@/api/generated/api'
import { loginRequest, updatePasswordRequest } from '@/features/auth/api'
import { ApiError, apiClient } from '@/lib/api-client'
import { resolvePageTitleKey } from '@/lib/page-title'
import {
  GAMES_URL,
  gameView,
  gamesReply,
  GUEST,
  matchOf,
  SERVER_ERROR,
  SIGNED_IN,
  slowReply,
  startApp,
  USER,
  type Reply,
} from './router-harness'

const ME_KEY = meQueryOptions().queryKey
const UPDATE_PASSWORD_URL = '/v1/auth/update-password'

let stop: (() => void) | undefined

async function open(path: string, me: Reply, games?: Reply) {
  const app = startApp({ path, me })
  stop = app.stop
  if (games) app.backend.replies.set(GAMES_URL, games)
  await app.router.load()
  return app
}

function where(app: Awaited<ReturnType<typeof open>>) {
  const { pathname, searchStr } = app.router.state.location
  return pathname + searchStr
}

function callAnEndpoint() {
  const payload = {
    old_password: 'a',
    new_password: 'b',
    confirm_password: 'b',
  }
  return updatePasswordRequest(payload).catch(() => {})
}

function everythingIn(value: unknown, seen = new Set<object>()): string {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null || seen.has(value)) return ''
  seen.add(value)
  return Object.getOwnPropertyNames(value)
    .map(
      (name) =>
        name +
        ' ' +
        everythingIn((value as Record<string, unknown>)[name], seen),
    )
    .join(' ')
}

// Lets a late answer reach the query before the test goes on.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(async () => {
  await i18n.changeLanguage('en')
  // Failed queries are logged with console.error in development.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.restoreAllMocks()
})

describe('public pages (AC-12)', () => {
  it('show to a guest inside the layout, with no redirect', async () => {
    const app = await open('/', GUEST)

    expect(where(app)).toBe('/')
    expect(matchOf(app.router, '/_app')?.status).toBe('success')
    expect(matchOf(app.router, '/_app/')?.status).toBe('success')
  })
})

describe('the account page (AC-13, AC-22)', () => {
  it('sends a guest to login with the page in `redirect`, and keeps a signed-in user', async () => {
    const guest = await open('/profile', GUEST)
    expect(where(guest)).toBe('/login?redirect=%2Fprofile')
    expect(matchOf(guest.router, '/login')?.search).toEqual({
      redirect: '/profile',
    })
    stop?.()

    const signedIn = await open('/profile', SIGNED_IN)
    expect(where(signedIn)).toBe('/profile')
    expect(matchOf(signedIn.router, '/_app/_account/profile')?.status).toBe(
      'success',
    )
  })

  it('carries the query and the hash of the page it protects', async () => {
    const app = await open('/profile?tab=password#form', GUEST)

    expect(matchOf(app.router, '/login')?.search).toEqual({
      redirect: '/profile?tab=password#form',
    })
  })
})

describe('the sign-in pages (AC-18, AC-19a)', () => {
  it.each(['/login', '/register', '/forgot-password'])(
    'send a signed-in user from %s to the home page',
    async (path) => {
      const app = await open(path, SIGNED_IN)

      expect(where(app)).toBe('/')
      stop?.()
    },
  )

  it('show the reset form with its token to a signed-in user', async () => {
    const app = await open('/reset-password?token=abc', SIGNED_IN)

    expect(where(app)).toBe('/reset-password?token=abc')
    expect(matchOf(app.router, '/reset-password')?.search).toEqual({
      token: 'abc',
    })
  })

  it('show to a guest even when the sign-in check fails (the page must stay usable)', async () => {
    const app = await open('/login', SERVER_ERROR)

    expect(where(app)).toBe('/login')
    expect(matchOf(app.router, '/login')?.status).toBe('success')
  })
})

describe('unknown paths (AC-10)', () => {
  it.each([
    ['a guest', GUEST],
    ['a signed-in user', SIGNED_IN],
  ])('give %s the not-found screen inside the layout', async (_who, me) => {
    const app = await open('/lists', me)

    expect(where(app)).toBe('/lists')
    expect(matchOf(app.router, '/_app')?.status).toBe('success')
    expect(matchOf(app.router, '/_app/$')?.status).toBe('notFound')
  })
})

describe('the game pages (AC-12, AC-39 to AC-45, AC-48)', () => {
  // "Today" is 2026-10-28 in UTC. Only Date is faked because the router needs real timers.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function shownPuzzle(app: Awaited<ReturnType<typeof open>>) {
    const leaf = app.router.state.matches.at(-1)
    // The router types a match's context for any route, so say which part this test reads.
    const { game, date } = (leaf?.context ?? {}) as {
      game?: { slug: string }
      date?: string | null
    }
    return { routeId: leaf?.routeId, slug: game?.slug, date }
  }

  function titleKey(app: Awaited<ReturnType<typeof open>>) {
    return resolvePageTitleKey(app.router.state.matches)
  }

  it.each([
    '/games/game-guesser',
    '/games/game-guesser/2026-10-01',
    '/games/game-guesser/archive',
  ])('show %s to a guest inside the layout, with no redirect', async (path) => {
    const app = await open(path, GUEST)

    expect(where(app)).toBe(path)
    expect(matchOf(app.router, '/_app')?.status).toBe('success')
    expect(app.router.state.matches.at(-1)?.status).toBe('success')
  })

  it('gives the screen no date on the home page and the game page, and the address date on a dated page', async () => {
    const home = await open('/', GUEST)
    expect(shownPuzzle(home)).toEqual({
      routeId: '/_app/',
      slug: 'game-guesser',
      date: null,
    })
    stop?.()

    const game = await open('/games/game-guesser', GUEST)
    expect(shownPuzzle(game)).toEqual({
      routeId: '/_app/games/$slug/',
      slug: 'game-guesser',
      date: null,
    })
    stop?.()

    const today = await open('/games/game-guesser/2026-10-28', GUEST)
    expect(where(today)).toBe('/games/game-guesser/2026-10-28')
    expect(shownPuzzle(today)).toEqual({
      routeId: '/_app/games/$slug/$date',
      slug: 'game-guesser',
      date: '2026-10-28',
    })
  })

  it('shows an earlier day with its date, and the archive page as the archive', async () => {
    const past = await open('/games/game-guesser/2026-02-28', GUEST)
    expect(shownPuzzle(past)).toMatchObject({
      slug: 'game-guesser',
      date: '2026-02-28',
    })
    stop?.()

    const archive = await open('/games/game-guesser/archive', GUEST)
    expect(archive.router.state.matches.at(-1)?.routeId).toBe(
      '/_app/games/$slug/archive',
    )
  })

  // A well-formed date is the backend's call (404 `puzzle_not_found`), shown by the screen.
  it('lets a future date through to the screen', async () => {
    const app = await open('/games/game-guesser/2099-01-01', GUEST)

    expect(shownPuzzle(app).date).toBe('2099-01-01')
  })

  it.each(['/games/nope', '/games/Game-Guesser', '/games/nope/2026-10-01'])(
    'gives %s the "unknown game" screen inside the layout',
    async (path) => {
      const app = await open(path, GUEST)

      expect(matchOf(app.router, '/_app/games/$slug')?.status).toBe('notFound')
      expect(matchOf(app.router, '/_app')?.status).toBe('success')
    },
  )

  it.each([
    '/games/game-guesser/2026-02-30',
    '/games/game-guesser/2026-1-5',
    '/games/game-guesser/today',
  ])('gives %s the "no puzzle" screen inside the layout', async (path) => {
    const app = await open(path, GUEST)

    expect(matchOf(app.router, '/_app/games/$slug/$date')?.status).toBe(
      'notFound',
    )
    expect(matchOf(app.router, '/_app/games/$slug')?.status).toBe('success')
    expect(matchOf(app.router, '/_app')?.status).toBe('success')
  })

  it('keeps a path without a slug in the layout as an unknown page', async () => {
    const app = await open('/games', GUEST)

    expect(matchOf(app.router, '/_app/$')?.status).toBe('notFound')
    expect(matchOf(app.router, '/_app')?.status).toBe('success')
  })

  it('names the tab after the game, the archive, or "not found" (AC-3)', async () => {
    const titles = new Map<string, string | undefined>()
    for (const path of [
      '/',
      '/games/game-guesser',
      '/games/game-guesser/2026-10-01',
      '/games/game-guesser/archive',
      '/games/nope',
      '/games/game-guesser/2026-02-30',
    ]) {
      titles.set(path, titleKey(await open(path, GUEST)))
      stop?.()
    }

    expect(Object.fromEntries(titles)).toEqual({
      '/': 'games.game_guesser.name',
      '/games/game-guesser': 'games.game_guesser.name',
      '/games/game-guesser/2026-10-01': 'games.game_guesser.name',
      '/games/game-guesser/archive': 'games.archive_title',
      '/games/nope': 'error_screen.not_found_title',
      '/games/game-guesser/2026-02-30': 'error_screen.not_found_title',
    })
  })
})

describe('the games both sides know (AC-7, AC-8)', () => {
  const GAME_PAGES = [
    '/',
    '/games/game-guesser',
    '/games/game-guesser/archive',
  ] as const

  it.each(GAME_PAGES)(
    'shows %s as not found inside the layout when the backend lists no such game',
    async (path) => {
      const app = await open(path, GUEST, gamesReply())

      expect(matchOf(app.router, '/_app')?.status).toBe('success')
      const notFound = app.router.state.matches.filter(
        (match) => match.status === 'notFound',
      )
      expect(notFound.map((match) => match.routeId)).toEqual([
        path === '/' ? '/_app/' : '/_app/games/$slug',
      ])
      expect(resolvePageTitleKey(app.router.state.matches)).toBe(
        'error_screen.not_found_title',
      )
    },
  )

  it.each([
    ['answers 500', SERVER_ERROR],
    ['has a network error', 'network-error'],
  ] as const)(
    'loads the game pages from the registry when the list %s',
    async (_what, games) => {
      for (const path of GAME_PAGES) {
        const app = await open(path, GUEST, games)

        expect(matchOf(app.router, '/_app')?.status).toBe('success')
        expect(app.router.state.matches.at(-1)?.status).toBe('success')
        stop?.()
      }
    },
  )

  it('asks for the list once while it is fresh', async () => {
    const app = await open('/games/game-guesser', GUEST)
    await app.router.navigate({ to: '/' })
    await app.router.navigate({
      to: '/games/$slug/archive',
      params: { slug: 'game-guesser' },
    })

    expect(app.backend.count(GAMES_URL)).toBe(1)
  })

  it('ignores a backend game the registry has no screen for', async () => {
    const list = gamesReply('game-guesser', 'word-game')

    const unknown = await open('/games/word-game', GUEST, list)
    expect(matchOf(unknown.router, '/_app/games/$slug')?.status).toBe(
      'notFound',
    )
    expect(matchOf(unknown.router, '/_app')?.status).toBe('success')
    stop?.()

    const home = await open('/', GUEST, list)
    expect(home.router.state.matches.at(-1)?.status).toBe('success')
  })
})

describe('the `redirect` search parameter (AC-15, AC-17)', () => {
  it('ignores a value that leaves the site and keeps one that does not', async () => {
    const evil = await open('/login?redirect=%2F%2Fevil.com', GUEST)
    expect(matchOf(evil.router, '/login')?.search).toEqual({
      redirect: undefined,
    })
    stop?.()

    const own = await open('/login?redirect=%2Fprofile', GUEST)
    expect(matchOf(own.router, '/login')?.search).toEqual({
      redirect: '/profile',
    })
    stop?.()

    const register = await open('/register?redirect=%2Fprofile', GUEST)
    expect(matchOf(register.router, '/register')?.search).toEqual({
      redirect: '/profile',
    })
  })

  it('treats the router matching /LOGIN as the login page, as the validation assumes', async () => {
    const app = await open('/LOGIN', GUEST)

    expect(matchOf(app.router, '/login')?.status).toBe('success')
  })
})

describe('a slow or failing `/auth/me` (AC-21, AC-22, AC-24)', () => {
  it('lets a public page load before the answer, and makes the account page wait', async () => {
    const publicPage = await open('/', 'never-answers')
    expect(matchOf(publicPage.router, '/_app/')?.status).toBe('success')
    stop?.()

    const app = startApp({ path: '/profile', me: 'never-answers' })
    stop = app.stop
    const outcome = await Promise.race([
      app.router.load().then(() => 'loaded'),
      new Promise((resolve) => setTimeout(() => resolve('still waiting'), 50)),
    ])

    expect(outcome).toBe('still waiting')
  })

  it('still shows public pages when `/auth/me` answers 500', async () => {
    const app = await open('/', SERVER_ERROR)

    expect(where(app)).toBe('/')
    expect(matchOf(app.router, '/_app/')?.status).toBe('success')
  })

  it('shows the error with its request id inside the layout on the account page', async () => {
    const app = await open('/profile', SERVER_ERROR)

    expect(where(app)).toBe('/profile')
    expect(matchOf(app.router, '/_app')?.status).toBe('success')
    const account = matchOf(app.router, '/_app/_account')
    expect(account?.status).toBe('error')
    expect(account?.error).toBeInstanceOf(ApiError)
    expect((account?.error as ApiError).requestId).toBe('req-500')
  })

  it('treats a guest answer as no error and does not ask again on the next page', async () => {
    const app = await open('/', GUEST)

    await app.router.navigate({ to: '/$', params: { _splat: 'lists' } })
    await app.router.navigate({ to: '/' })

    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(app.backend.count('/v1/auth/me')).toBe(1)
  })
})

describe('a 401 in the middle of a session (AC-25, AC-26)', () => {
  it('on the account page: signs out, shows the message, goes to login with the page', async () => {
    const info = vi.spyOn(toast, 'info')
    const app = await open('/profile', SIGNED_IN)
    app.backend.replies.set(UPDATE_PASSWORD_URL, GUEST)

    await callAnEndpoint()

    await vi.waitFor(() =>
      expect(where(app)).toBe('/login?redirect=%2Fprofile'),
    )
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(info).toHaveBeenCalledWith(
      'Your session has ended. Please log in again.',
    )
  })

  it('on a public page: stays there and stays signed out after the next navigation', async () => {
    const info = vi.spyOn(toast, 'info')
    const app = await open('/', SIGNED_IN)
    app.backend.replies.set(UPDATE_PASSWORD_URL, GUEST)

    await callAnEndpoint()

    expect(where(app)).toBe('/')
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(info).not.toHaveBeenCalled()

    // Regression: the old guard cleared only its own store, so the cached `/auth/me` brought
    // the user back on the next navigation. The fake still answers with a user.
    await app.router.navigate({ to: '/$', params: { _splat: 'lists' } })
    await app.router.navigate({ to: '/' })
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(app.backend.count('/v1/auth/me')).toBe(1)

    await app.router.navigate({ to: '/profile' })
    expect(where(app)).toBe('/login?redirect=%2Fprofile')
  })

  it('leaves a failed login alone, because nobody is signed in then', async () => {
    const info = vi.spyOn(toast, 'info')
    const app = await open('/', GUEST)
    app.backend.replies.set(UPDATE_PASSWORD_URL, GUEST)

    await callAnEndpoint()

    expect(info).not.toHaveBeenCalled()
    expect(where(app)).toBe('/')
  })

  it('drops other cached account data too', async () => {
    const app = await open('/', SIGNED_IN)
    app.queryClient.setQueryData(['games', 'progress'], { solved: 3 })
    app.backend.replies.set(UPDATE_PASSWORD_URL, GUEST)

    await callAnEndpoint()

    expect(app.queryClient.getQueryData(['games', 'progress'])).toBeUndefined()
  })
})

describe('a game response that says signed_in: false (AC-42)', () => {
  const SLUG = 'game-guesser'
  const DATE = '2026-11-05'
  const PUZZLE_URL = `/v1/games/${SLUG}/puzzles/${DATE}`
  // Calls the generated function so the URL comes from it.
  const askForPuzzle = () => gamesGetPuzzle(SLUG, DATE)

  it('on a public page: signs out, stays on the page, shows no message, drops other queries', async () => {
    const info = vi.spyOn(toast, 'info')
    const app = await open('/', SIGNED_IN)
    app.queryClient.setQueryData(['games', 'progress'], { solved: 3 })
    const view = gameView({ signed_in: false })
    app.backend.replies.set(PUZZLE_URL, { status: 200, data: view })

    expect(await askForPuzzle()).toEqual(view)

    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(app.queryClient.getQueryData(['games', 'progress'])).toBeUndefined()
    expect(where(app)).toBe('/')
    expect(info).not.toHaveBeenCalled()
  })

  it('on the account page: shows the message and goes to login with the page', async () => {
    const info = vi.spyOn(toast, 'info')
    const app = await open('/profile', SIGNED_IN)
    app.backend.replies.set(PUZZLE_URL, {
      status: 200,
      data: gameView({ signed_in: false }),
    })

    await askForPuzzle()

    await vi.waitFor(() =>
      expect(where(app)).toBe('/login?redirect=%2Fprofile'),
    )
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(info).toHaveBeenCalledWith(
      'Your session has ended. Please log in again.',
    )
  })

  it('leaves the user alone for signed_in: true', async () => {
    const app = await open('/', SIGNED_IN)
    app.backend.replies.set(PUZZLE_URL, {
      status: 200,
      data: gameView({ signed_in: true }),
    })

    await askForPuzzle()

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
  })

  it('leaves the user alone when the field is missing or null, only `false` counts', async () => {
    const app = await open('/', SIGNED_IN)
    const { signed_in: _missing, ...withoutField } = gameView()
    void _missing

    for (const data of [withoutField, { ...gameView(), signed_in: null }]) {
      app.backend.replies.set(PUZZLE_URL, { status: 200, data })
      await askForPuzzle()
    }

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
  })

  it('leaves the user alone on a path that is not a game route', async () => {
    const app = await open('/', SIGNED_IN)
    const data = gameView({ signed_in: false })
    for (const url of ['/v1/other', '/v1/gamesx/a', '/v1/games']) {
      app.backend.replies.set(url, { status: 200, data })
      await apiClient.get(url)
    }

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
  })

  it('does nothing for a guest, and throws nothing', async () => {
    const info = vi.spyOn(toast, 'info')
    const app = await open('/', GUEST)
    app.queryClient.setQueryData(['games', 'progress'], { solved: 3 })
    app.backend.replies.set(PUZZLE_URL, {
      status: 200,
      data: gameView({ signed_in: false }),
    })

    await expect(askForPuzzle()).resolves.toBeDefined()

    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(app.queryClient.getQueryData(['games', 'progress'])).toEqual({
      solved: 3,
    })
    expect(info).not.toHaveBeenCalled()
  })

  it('leaves the new user alone when the request was sent as a guest and answered after the login', async () => {
    const app = await open('/', GUEST)
    const late = slowReply()
    app.backend.replies.set(PUZZLE_URL, late.reply)

    // No await between the call and the login, because the request is stamped when sent.
    const pending = askForPuzzle()
    onAuthSuccess(app.queryClient, USER)
    late.answer({ status: 200, data: gameView({ signed_in: false }) })
    await pending

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
  })

  it('leaves the new session alone when a request sent before a re-login answers 401 after it', async () => {
    const app = await open('/', SIGNED_IN)
    const late = slowReply()
    app.backend.replies.set(UPDATE_PASSWORD_URL, late.reply)

    const pending = callAnEndpoint()
    onAuthSuccess(app.queryClient, USER)
    late.answer(GUEST)
    await pending

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
  })

  it('still signs out when the request was sent and answered in the same session', async () => {
    const app = await open('/', SIGNED_IN)
    const lateGame = slowReply()
    app.backend.replies.set(PUZZLE_URL, lateGame.reply)

    const pending = askForPuzzle()
    await settle()
    lateGame.answer({ status: 200, data: gameView({ signed_in: false }) })
    await pending
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()

    onAuthSuccess(app.queryClient, USER)
    const late401 = slowReply()
    app.backend.replies.set(UPDATE_PASSWORD_URL, late401.reply)
    const pending401 = callAnEndpoint()
    await settle()
    late401.answer(GUEST)
    await pending401
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
  })

  it('treats a sign-out as the end of the session too, whatever brings the user back', async () => {
    const app = await open('/', SIGNED_IN)
    const late = slowReply()
    app.backend.replies.set(PUZZLE_URL, late.reply)

    const pending = askForPuzzle()
    signOutLocally(app.queryClient)
    app.queryClient.setQueryData(ME_KEY, USER)
    late.answer({ status: 200, data: gameView({ signed_in: false }) })
    await pending

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
  })

  it('never turns the answer into an error when signing out fails, and reports it', async () => {
    const app = await open('/', SIGNED_IN)
    const view = gameView({ signed_in: false })
    app.backend.replies.set(PUZZLE_URL, { status: 200, data: view })
    vi.spyOn(app.queryClient, 'setQueryData').mockImplementation(() => {
      throw new Error('cache broke')
    })

    await expect(askForPuzzle()).resolves.toEqual(view)

    expect(console.error).toHaveBeenCalled()
  })

  it('looks at the address the request really goes to', async () => {
    const body = gameView({ signed_in: false })
    const cases: {
      name: string
      send: () => Promise<unknown>
      key: string
      signsOut: boolean
    }[] = [
      {
        name: 'an absolute url on this site',
        send: () => apiClient.get(`http://localhost:5173/api${PUZZLE_URL}`),
        key: PUZZLE_URL,
        signsOut: true,
      },
      {
        name: 'a path that only resolves into the game routes',
        send: () => apiClient.get(`/v1/auth/../games/${SLUG}/puzzles/today`),
        key: `/v1/games/${SLUG}/puzzles/today`,
        signsOut: true,
      },
      {
        name: 'a game path under a base url on another host',
        send: () =>
          apiClient.get(PUZZLE_URL, { baseURL: 'https://other.example/api' }),
        key: `https://other.example/api${PUZZLE_URL}`,
        signsOut: false,
      },
      {
        name: 'a game path that resolves out of the game routes',
        send: () => apiClient.get(`/v1/games/../other`),
        key: '/v1/other',
        signsOut: false,
      },
    ]

    for (const { name, send, key, signsOut } of cases) {
      const app = await open('/', SIGNED_IN)
      app.backend.replies.set(key, { status: 200, data: body })
      await send()
      expect(app.queryClient.getQueryData(ME_KEY), name).toEqual(
        signsOut ? null : USER,
      )
      expect(app.backend.requests, name).toEqual(expect.arrayContaining([key]))
      stop?.()
      stop = undefined
    }
  })

  it('leaves the user alone for bodies where signed_in is not a top-level false', async () => {
    const bodies: [string, unknown][] = [
      ['nested in a step', { ...gameView(), steps: [{ signed_in: false }] }],
      ['nested in an object', { ...gameView(), extra: { signed_in: false } }],
      ['an html string', '<html><body>signed_in: false</body></html>'],
      ['an empty string', ''],
      ['null', null],
      ['an array', [{ signed_in: false }]],
      ['a blob', new Blob(['{"signed_in":false}'])],
    ]
    const app = await open('/', SIGNED_IN)

    for (const [name, data] of bodies) {
      app.backend.replies.set(PUZZLE_URL, { status: 200, data })
      await askForPuzzle()
      expect(app.queryClient.getQueryData(ME_KEY), name).toEqual(USER)
    }
  })

  it('is removed, with the stamp and the 401 reaction, by the one eject', async () => {
    const app = await open('/', SIGNED_IN)
    app.backend.replies.set(PUZZLE_URL, { status: 200, data: gameView() })
    app.backend.replies.set(UPDATE_PASSWORD_URL, GUEST)

    await askForPuzzle()
    expect(typeof app.backend.configs.at(-1)?.sessionEpoch).toBe('number')

    app.removeSessionGuard()
    app.backend.replies.set(PUZZLE_URL, {
      status: 200,
      data: gameView({ signed_in: false }),
    })
    await askForPuzzle()
    expect(app.backend.configs.at(-1)?.sessionEpoch).toBeUndefined()
    await callAnEndpoint()
    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)

    const epoch = getSessionEpoch()
    const other: typeof USER = { ...USER, id: 'user-2' }
    app.queryClient.setQueryData(ME_KEY, other)
    expect(getSessionEpoch()).toBe(epoch)
  })

  it('treats another user in the `me` data as a new session', async () => {
    const app = await open('/', SIGNED_IN)
    const late = slowReply()
    app.backend.replies.set(PUZZLE_URL, late.reply)

    const pending = askForPuzzle()
    const other = { ...USER, id: 'user-2', email: 'other@example.com' }
    app.queryClient.setQueryData(ME_KEY, other)
    late.answer({ status: 200, data: gameView({ signed_in: false }) })
    await pending

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(other)
  })

  it('never rejects a good response when the address cannot be resolved', async () => {
    const app = await open('/', SIGNED_IN)
    const late = slowReply()
    const view = gameView({ signed_in: false })
    app.backend.replies.set(PUZZLE_URL, late.reply)
    const getUri = apiClient.getUri.bind(apiClient)
    let answered = false
    vi.spyOn(apiClient, 'getUri').mockImplementation((config) => {
      if (answered) throw new TypeError('Invalid URL')
      return getUri(config)
    })

    // The fake backend resolved the address at send time; from here getUri throws.
    const pending = askForPuzzle()
    answered = true
    late.answer({ status: 200, data: view })

    await expect(pending).resolves.toEqual(view)
    expect(console.error).toHaveBeenCalled()
  })

  it('does not resolve the address of an answer that is not a guest game answer', async () => {
    const app = await open('/', SIGNED_IN)
    const late = slowReply()
    app.backend.replies.set(PUZZLE_URL, late.reply)
    const getUri = vi.spyOn(apiClient, 'getUri')

    const pending = askForPuzzle()
    getUri.mockClear()
    late.answer({ status: 200, data: gameView({ signed_in: true }) })
    await pending

    expect(getUri).not.toHaveBeenCalled()
  })

  it('matches the game routes when the base url ends in a slash', async () => {
    const app = await open('/', SIGNED_IN)
    app.backend.replies.set(PUZZLE_URL, {
      status: 200,
      data: gameView({ signed_in: false }),
    })
    apiClient.defaults.baseURL = '/api/'
    try {
      await askForPuzzle()
    } finally {
      apiClient.defaults.baseURL = '/api'
    }

    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
  })
})

describe('an ApiError holds no part of the request', () => {
  it('has no password in any of its properties after a failed login', async () => {
    const app = await open('/login', GUEST)
    app.backend.replies.set('/v1/auth/login', {
      status: 401,
      data: { status: 401, code: 'invalid_credentials', request_id: 'r-1' },
    })

    const error = await loginRequest({
      email: USER.email,
      password: 'hunter2-plaintext',
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(everythingIn(error)).not.toContain('hunter2-plaintext')
    expect(everythingIn(error)).toContain('invalid_credentials')
    expect(app.backend.requests).toContain('/v1/auth/login')
  })
})

describe('logging out (AC-20)', () => {
  it('clears everything, and leaves an account page for the home page', async () => {
    const app = await open('/profile', SIGNED_IN)
    app.queryClient.setQueryData(['games', 'progress'], { solved: 3 })

    await finishLogout(app.queryClient, app.router)

    expect(where(app)).toBe('/')
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(app.queryClient.getQueryData(['games', 'progress'])).toBeUndefined()
  })

  it('stays on a public page', async () => {
    const app = await open('/lists', SIGNED_IN)

    await finishLogout(app.queryClient, app.router)

    expect(where(app)).toBe('/lists')
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
  })
})

describe('a password reset while signed in (AC-19b)', () => {
  it('leaves the signed-out state and ends on the login page', async () => {
    const app = await open('/reset-password?token=abc', SIGNED_IN)
    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)

    await finishPasswordReset(app.queryClient, app.router)

    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(where(app)).toBe('/login')
  })
})

describe('an `/auth/me` answer that arrives after the session changed (AC-19b)', () => {
  it('does not bring the user back after a password reset', async () => {
    // The reset page does not wait for `/auth/me`, so the reset can finish first.
    const late = slowReply()
    const app = await open('/reset-password?token=abc', late.reply)

    await finishPasswordReset(app.queryClient, app.router)
    late.answer(SIGNED_IN)
    await settle()

    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
    expect(where(app)).toBe('/login')
  })

  it('does not replace the user who just logged in', async () => {
    const late = slowReply()
    const app = await open('/', late.reply)

    onAuthSuccess(app.queryClient, USER)
    late.answer({
      status: 200,
      data: { ...USER, id: 'user-0', email: 'older-answer@example.com' },
    })
    await settle()

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
  })

  it('does not sign out the user who just logged in when the replaced request answers 401', async () => {
    // The login cancels the running `/auth/me` query, but that does not stop the HTTP request
    // unless the query passes its signal on, so its 401 would reach the session guard.
    const late = slowReply()
    const app = await open('/', late.reply)

    onAuthSuccess(app.queryClient, USER)
    app.queryClient.setQueryData(['games', 'progress'], { solved: 3 })
    late.answer(GUEST)
    await settle()

    expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
    expect(app.queryClient.getQueryData(['games', 'progress'])).toEqual({
      solved: 3,
    })
    expect(where(app)).toBe('/')
  })
})
