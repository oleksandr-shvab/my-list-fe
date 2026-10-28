import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'
import { RegisterForm } from '@/features/auth/components/register-form'
import { AuthPage } from '@/features/auth/components/auth-page'
import { resolveRedirect } from '@/features/auth/redirect'
import { redirectIfSignedIn } from '@/features/auth/session'

export const Route = createFileRoute('/register')({
  staticData: { pageTitle: 'auth.register.title' },
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: resolveRedirect(search.redirect, window.location.origin),
  }),
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  pendingComponent: PendingScreen,
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect } = Route.useSearch()

  return (
    <AuthPage>
      <RegisterForm redirectTo={redirect} />
    </AuthPage>
  )
}
