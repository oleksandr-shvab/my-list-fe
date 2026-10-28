import { describe, expect, it } from 'vitest'
import { getSessionStatus } from './session'
import type { User } from './types'

const user: User = {
  id: 'user-1',
  email: 'player@example.com',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

describe('getSessionStatus', () => {
  it('reads the state of the `/auth/me` query as one of four statuses', () => {
    const idle = { isFetching: false, isError: false }

    expect(getSessionStatus({ ...idle, data: user })).toBe('signed_in')
    expect(getSessionStatus({ ...idle, data: null })).toBe('guest')
    expect(
      getSessionStatus({ data: undefined, isFetching: true, isError: false }),
    ).toBe('pending')
    expect(
      getSessionStatus({ data: undefined, isFetching: false, isError: true }),
    ).toBe('error')
  })

  it('shows pending, not the old failure, while a failed check is retried', () => {
    expect(
      getSessionStatus({ data: undefined, isFetching: true, isError: true }),
    ).toBe('pending')
  })
})
