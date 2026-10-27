import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { mapApiErrorToForm } from './map-error-to-form'

type Values = { email: string; password: string }

describe('mapApiErrorToForm', () => {
  it('puts known fields on their input and the rest on the form', () => {
    const setError = vi.fn()
    const error = new ApiError({
      status: 422,
      code: 'validation_error',
      fieldErrors: [
        { field: 'password', code: 'too_short', params: { min: 8 } },
        {
          field: 'confirm_password',
          code: 'passwords_do_not_match',
          params: {},
        },
      ],
    })

    mapApiErrorToForm<Values>(error, setError, ['email', 'password'])

    expect(setError).toHaveBeenCalledWith('password', {
      message: 'Must be at least 8 characters.',
    })
    expect(setError).toHaveBeenCalledWith('root', {
      message: 'Passwords do not match.',
    })
  })

  it('shows a non-validation error as a form-level message chosen by its code', () => {
    const setError = vi.fn()
    const error = new ApiError({ status: 401, code: 'invalid_credentials' })

    mapApiErrorToForm<Values>(error, setError, ['email', 'password'])

    expect(setError).toHaveBeenCalledWith('root', {
      message: 'Invalid email or password.',
    })
  })
})
