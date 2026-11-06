import { createFileRoute, notFound } from '@tanstack/react-router'

import { NotFoundScreen } from '@/components/error-screen'

// Catches every unmatched path so the "not found" screen renders inside the app layout.
export const Route = createFileRoute('/_app/$')({
  beforeLoad: () => {
    throw notFound()
  },
  notFoundComponent: NotFoundScreen,
})
