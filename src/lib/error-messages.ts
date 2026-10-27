import type { TFunction } from 'i18next'
import type { ApiError, FieldError } from '@/lib/api-client'

// The backend sends stable codes; the texts live in the catalogues (errors.<code>). Dynamic keys
// are not in the typed key set, so go through a loosely typed call and fall back to errors.unknown.
type LooseT = (
  key: string | string[],
  options?: Record<string, unknown>,
) => string

// Russian plurals depend on a number: the backend's min and max become i18next's `count`.
function withCount(params: Record<string, unknown>): Record<string, unknown> {
  const count = params.min ?? params.max
  return typeof count === 'number' ? { ...params, count } : params
}

function translate(
  t: TFunction,
  code: string,
  fallbackKey: string,
  params: Record<string, unknown>,
): string {
  return (t as unknown as LooseT)(
    [`errors.${code}`, fallbackKey],
    withCount(params),
  )
}

export function getFieldErrorMessage(error: FieldError, t: TFunction): string {
  return translate(t, error.code, 'errors.invalid_value', error.params)
}

export function getErrorMessage(error: ApiError, t: TFunction): string {
  return translate(t, error.code, 'errors.unknown', error.params)
}
