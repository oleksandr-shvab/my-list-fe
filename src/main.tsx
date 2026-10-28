import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import { installSessionGuard } from './features/auth/session-guard'
import { createQueryClient } from './lib/query-client'
import { reportError } from './lib/report-error'
import { reloadOnceAfterFailedChunk } from './lib/version-skew'
import { createAppRouter } from './router'

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)
installSessionGuard({ queryClient, router })

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
