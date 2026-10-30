// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterContextProvider } from '@tanstack/react-router'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GUEST,
  SERVER_ERROR,
  SIGNED_IN,
  startApp,
  USER,
  type Reply,
} from '@/test/router-harness'
import {
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useResetPasswordMutation,
} from './mutations'
import { meQueryOptions } from './queries'

// These hooks are the only place that connects a successful request to the session and to the
// router (see session.ts). session.test.ts and routing.test.ts cover the functions they call;
// the tests here fail when one of the hooks stops calling them.

const ME_KEY = meQueryOptions().queryKey
const PROGRESS_KEY = ['games', 'progress']

let stop: (() => void) | undefined

async function open(path: string, me: Reply) {
  const app = startApp({ path, me })
  stop = app.stop
  await app.router.load()
  return app
}

function renderMutation<T>(
  hook: () => T,
  app: Awaited<ReturnType<typeof open>>,
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={app.queryClient}>
        <RouterContextProvider router={app.router}>
          {children}
        </RouterContextProvider>
      </QueryClientProvider>
    )
  }
  return renderHook(hook, { wrapper: Providers })
}

beforeEach(() => {
  // A failed request is reported through console.error in development.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.restoreAllMocks()
})

describe('useLogoutMutation (AC-20)', () => {
  it.each([
    ['the request succeeds', { status: 204 }],
    ['the request fails', SERVER_ERROR],
  ])(
    'signs out here and leaves the account page when %s',
    async (_case, answer) => {
      const app = await open('/profile', SIGNED_IN)
      app.queryClient.setQueryData(PROGRESS_KEY, { solved: 3 })
      app.backend.replies.set('/v1/auth/logout', answer)
      const { result } = renderMutation(() => useLogoutMutation(), app)

      await act(async () => result.current.mutate())

      await waitFor(() => expect(app.router.state.location.pathname).toBe('/'))
      expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
      expect(app.queryClient.getQueryData(PROGRESS_KEY)).toBeUndefined()
    },
  )
})

describe('useResetPasswordMutation (AC-19b)', () => {
  it('signs out here and goes to the login page when the reset succeeds', async () => {
    const app = await open('/reset-password?token=abc', SIGNED_IN)
    app.backend.replies.set('/v1/auth/reset-password', { status: 204 })
    const { result } = renderMutation(() => useResetPasswordMutation(), app)

    await act(async () =>
      result.current.mutate({
        token: 'abc',
        new_password: 'a-new-password',
        confirm_password: 'a-new-password',
      }),
    )

    await waitFor(() =>
      expect(app.router.state.location.pathname).toBe('/login'),
    )
    expect(app.queryClient.getQueryData(ME_KEY)).toBeNull()
  })
})

describe('useLoginMutation and useRegisterMutation (AC-14)', () => {
  it.each([
    ['login', '/v1/auth/login', useLoginMutation],
    ['sign-up', '/v1/auth/register', useRegisterMutation],
  ])(
    'after %s, show the user and go to the checked target, or home without one',
    async (_flow, url, useMutationUnderTest) => {
      const checkedTarget = '/profile?tab=password#form'

      for (const [redirectTo, expected] of [
        [checkedTarget, checkedTarget],
        [undefined, '/'],
      ]) {
        const app = await open('/login', GUEST)
        app.backend.replies.set(url, { status: 200, data: USER })
        const { result } = renderMutation(
          () => useMutationUnderTest(redirectTo),
          app,
        )

        await act(async () =>
          result.current.mutate({ email: USER.email, password: 'a-password' }),
        )

        // Nothing renders the matches here, so the router does not follow the history.
        await waitFor(() =>
          expect(app.router.history.location.href).toBe(expected),
        )
        expect(app.queryClient.getQueryData(ME_KEY)).toEqual(USER)
        stop?.()
      }
    },
  )
})
