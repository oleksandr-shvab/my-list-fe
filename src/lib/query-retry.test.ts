import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { shouldRetryQuery } from './query-retry'

const apiError = (status: number) => new ApiError({ status, code: 'x' })

describe('shouldRetryQuery', () => {
  it('retries network errors, 5xx, 408 and 429, at most twice', () => {
    expect(shouldRetryQuery(0, apiError(0))).toBe(true)
    expect(shouldRetryQuery(1, apiError(503))).toBe(true)
    expect(shouldRetryQuery(0, apiError(408))).toBe(true)
    expect(shouldRetryQuery(0, apiError(429))).toBe(true)
    expect(shouldRetryQuery(2, apiError(503))).toBe(false)
  })

  it('does not retry other client errors', () => {
    expect(shouldRetryQuery(0, apiError(401))).toBe(false)
    expect(shouldRetryQuery(0, apiError(404))).toBe(false)
    expect(shouldRetryQuery(0, apiError(422))).toBe(false)
  })
})
