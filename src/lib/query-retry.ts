import { ApiError } from '@/lib/api-client'

const MAX_RETRIES = 2

// Retry only what can heal itself: network errors, 5xx, 408 and 429. Never other 4xx. At most two retries.
export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (failureCount >= MAX_RETRIES) return false
  if (!(error instanceof ApiError)) return true
  return (
    error.isNetworkError ||
    error.status >= 500 ||
    error.status === 408 ||
    error.status === 429
  )
}
