import { queryOptions } from '@tanstack/react-query'
import { getMe } from './api'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

export function meQueryOptions() {
  return queryOptions({
    queryKey: authKeys.me,
    queryFn: getMe,
    retry: false,
    staleTime: Infinity,
  })
}
