import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage, getFieldErrorMessage } from '@/lib/error-messages'

describe('error messages', () => {
  it('looks the text up by code and fills the params', () => {
    expect(
      getFieldErrorMessage({
        field: 'password',
        code: 'too_short',
        params: { min: 8 },
      }),
    ).toBe('Must be at least 8 characters.')
  })

  it('falls back to a generic text for an unknown code, never to backend English', () => {
    const error = new ApiError({
      status: 418,
      code: 'teapot',
      message: 'I am a teapot',
    })

    expect(getErrorMessage(error)).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
