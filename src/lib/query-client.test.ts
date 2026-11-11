import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api-client'
import { createQueryClient } from './query-client'
import { reportError } from './report-error'

vi.mock('./report-error', () => ({ reportError: vi.fn() }))

function fail(status: number, meta?: { expectedStatuses: number[] }) {
  return createQueryClient()
    .fetchQuery({
      queryKey: ['q', status],
      queryFn: () =>
        Promise.reject(new ApiError({ status, code: `status_${status}` })),
      retry: false,
      meta,
    })
    .catch(() => undefined)
}

afterEach(() => vi.mocked(reportError).mockClear())

describe('reporting failed queries', () => {
  it('skips the statuses a query lists as expected and reports any other failure', async () => {
    await fail(401, { expectedStatuses: [401, 404] })
    expect(reportError).not.toHaveBeenCalled()

    // The same query failing with a status it did not list is a real fault, and so is a failure with no list.
    await fail(500, { expectedStatuses: [401, 404] })
    await fail(401)
    expect(reportError).toHaveBeenCalledTimes(2)
  })
})
