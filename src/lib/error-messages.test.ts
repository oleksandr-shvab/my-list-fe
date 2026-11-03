import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage, getFieldErrorMessage } from '@/lib/error-messages'

describe('error messages', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('looks the text up by code and fills the params', () => {
    expect(
      getFieldErrorMessage(
        { field: 'password', code: 'too_short', params: { min: 8 } },
        i18n.t,
      ),
    ).toBe('Must be at least 8 characters.')
  })

  it('uses the singular form for one', () => {
    expect(
      getFieldErrorMessage(
        { field: 'x', code: 'too_short', params: { min: 1 } },
        i18n.t,
      ),
    ).toBe('Must be at least 1 character.')
  })

  it('falls back to a generic text for an unknown code, never to backend English', () => {
    const error = new ApiError({
      status: 418,
      code: 'teapot',
      message: 'I am a teapot',
    })

    expect(getErrorMessage(error, i18n.t)).toBe(
      'Something went wrong. Please try again.',
    )
  })

  it('explains a refused origin in English and in Russian (AC-89)', async () => {
    const error = new ApiError({
      status: 403,
      code: 'csrf_origin_mismatch',
    })

    expect(getErrorMessage(error, i18n.t)).toBe(
      'This request came from an address the site does not accept. Open the site at its usual address and try again.',
    )

    await i18n.changeLanguage('ru')
    expect(getErrorMessage(error, i18n.t)).toBe(
      'Запрос пришёл с адреса, который сайт не принимает. Откройте сайт по обычному адресу и попробуйте снова.',
    )
  })

  it('speaks Russian with the right plural forms when the language is Russian', async () => {
    await i18n.changeLanguage('ru')
    const message = (min: number) =>
      getFieldErrorMessage(
        { field: 'password', code: 'too_short', params: { min } },
        i18n.t,
      )

    expect(message(1)).toBe('Не менее 1 символа.')
    expect(message(8)).toBe('Не менее 8 символов.')
    expect(
      getErrorMessage(
        new ApiError({ status: 401, code: 'invalid_credentials' }),
        i18n.t,
      ),
    ).toBe('Неверная почта или пароль.')
  })
})
