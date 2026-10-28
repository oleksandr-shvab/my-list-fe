import './browser-stubs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { meQueryOptions } from '@/features/auth/queries'
import { onAuthSuccess } from '@/features/auth/mutations'
import { finishLogout, finishPasswordReset } from '@/features/auth/session'
import { updatePasswordRequest } from '@/features/auth/api'
import { ApiError } from '@/lib/api-client'
import {
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

// Opens `path` as the first page of a fresh app and waits for the first load.
async function open(path: string, me: Reply) {
  const app = startApp({ path, me })
  stop = app.stop
  await app.router.load()
  return app
}

function where(app: Awaited<ReturnType<typeof open>>) {
  const { pathname, searchStr } = app.router.state.location
  return pathname + searchStr
}

// A call to any endpoint that answers 401 while the page shows a signed-in user.
function callAnEndpoint() {
  const payload = {
    old_password: 'a',
    new_password: 'b',
    confirm_password: 'b',
  }
  return updatePasswordRequest(payload).catch(() => {})
}

// Lets a settled promise run its handlers: the late answer reaches the query before this returns.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(async () => {
  await i18n.changeLanguage('en')
  // Failed queries are reported through console.error in development.
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

    // The stale-cache bug: the old guard cleared its own store only, so the cached `/auth/me`
    // brought the user back on the next navigation. The fake would still answer with a user.
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
    // The reset page does not wait for `/auth/me`, so the reset can finish before the answer.
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
    // The login cancels the `/auth/me` request that was still running. Cancelling the query does
    // not stop the HTTP request unless the query passes its signal on, so its 401 would reach the
    // session guard while the new user is shown.
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
