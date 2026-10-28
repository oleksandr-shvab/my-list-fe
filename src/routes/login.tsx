import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'
import { LoginForm } from '@/features/auth/components/login-form'
import { AuthPage } from '@/features/auth/components/auth-page'
import { resolveRedirect } from '@/features/auth/redirect'
import { redirectIfSignedIn } from '@/features/auth/session'

export const Route = createFileRoute('/login')({
  staticData: { pageTitle: 'auth.login.title' },
  // A rejected `redirect` is dropped without a message (the visitor ends on the home page).
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: resolveRedirect(search.redirect, window.location.origin),
  }),
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  pendingComponent: PendingScreen,
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()

  return (
    <AuthPage>
      <LoginForm redirectTo={redirect} />
    </AuthPage>
  )
}
