import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { shouldRetryQuery } from './query-retry'
import { reportError } from './report-error'

// A function, not a shared instance, so tests can start from a clean cache.
// Forms show their own errors; these callbacks only report what nobody else handles.
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => reportError(error, 'query'),
    }),
    mutationCache: new MutationCache({
      onError: (error) => reportError(error, 'mutation'),
    }),
    defaultOptions: {
      queries: { retry: shouldRetryQuery },
      mutations: { retry: false },
    },
  })
}
