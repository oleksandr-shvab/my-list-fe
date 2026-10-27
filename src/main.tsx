import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import './features/auth/session-guard'
import { ErrorScreen, NotFoundScreen } from './components/error-screen'
import { shouldRetryQuery } from './lib/query-retry'
import { reportError } from './lib/report-error'
import { reloadOnceAfterFailedChunk } from './lib/version-skew'
import { routeTree } from './routeTree.gen'

// Forms show their own errors; these callbacks only report what nobody else handles.
const queryClient = new QueryClient({
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

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultErrorComponent: ErrorScreen,
  defaultNotFoundComponent: NotFoundScreen,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

reloadOnceAfterFailedChunk()

createRoot(document.getElementById('root')!, {
  onCaughtError: (error) => reportError(error, 'react: caught by a boundary'),
  onUncaughtError: (error) => reportError(error, 'react: uncaught'),
  onRecoverableError: (error) => reportError(error, 'react: recoverable'),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
