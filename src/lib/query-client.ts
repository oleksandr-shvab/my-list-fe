import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api-client'
import { shouldRetryQuery } from './query-retry'
import { reportError } from './report-error'

declare module '@tanstack/react-query' {
  interface Register {
    // Statuses a query expects as a normal answer (a 401 for a guest): they are not reported.
    queryMeta: { expectedStatuses?: readonly number[] }
  }
}

// A function so tests can start from a clean cache.
// Forms show their own errors; these callbacks only report what nobody else handles.
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (
          error instanceof ApiError &&
          query.meta?.expectedStatuses?.includes(error.status)
        ) {
          return
        }
        reportError(error, 'query')
      },
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
