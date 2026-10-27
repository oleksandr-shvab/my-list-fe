import type { ApiError, FieldError } from '@/lib/api-client'

// Temporary English texts for the backend's error codes. When the translation library lands
// (react-i18next) each entry becomes the key `errors.<code>` in the English and Russian
// catalogues, and this file goes away. Codes are the contract; the texts are not.
const MESSAGES: Record<string, string> = {
  email_already_registered: 'An account with this email already exists.',
  invalid_credentials: 'Invalid email or password.',
  not_authenticated: 'Please sign in to continue.',
  invalid_or_expired_reset_token:
    'This reset link is invalid or has expired. Request a new one.',
  incorrect_password: 'The current password is incorrect.',
  passwords_do_not_match: 'Passwords do not match.',
  new_password_same_as_old:
    'The new password must be different from the current one.',
  too_many_requests: 'Too many attempts. Please wait a moment and try again.',
  service_unavailable:
    'The service is temporarily unavailable. Please try again soon.',
  internal_error: 'Something went wrong on our side. Please try again.',
  network_error: 'Network error. Check your connection and try again.',
  required: 'This field is required.',
  too_short: 'Must be at least {min} characters.',
  too_long: 'Must be at most {max} characters.',
  invalid_value: 'This value is not valid.',
}

const FALLBACK = 'Something went wrong. Please try again.'

function fill(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? ''),
  )
}

export function getFieldErrorMessage(error: FieldError): string {
  return fill(MESSAGES[error.code] ?? MESSAGES.invalid_value, error.params)
}

export function getErrorMessage(error: ApiError): string {
  return fill(MESSAGES[error.code] ?? FALLBACK, error.params)
}
