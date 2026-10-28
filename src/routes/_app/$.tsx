import { createFileRoute, notFound } from '@tanstack/react-router'

import { NotFoundScreen } from '@/components/error-screen'

// Catches every path no other route matches, so the "not found" screen renders
// inside the app layout instead of replacing it.
export const Route = createFileRoute('/_app/$')({
  beforeLoad: () => {
    throw notFound()
  },
  notFoundComponent: NotFoundScreen,
})
