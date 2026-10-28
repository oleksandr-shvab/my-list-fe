import { createFileRoute } from '@tanstack/react-router'
import { PendingScreen } from '@/components/pending-screen'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'
import { AuthPage } from '@/features/auth/components/auth-page'
import { redirectIfSignedIn } from '@/features/auth/session'

export const Route = createFileRoute('/forgot-password')({
  staticData: { pageTitle: 'auth.forgot.title' },
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  pendingComponent: PendingScreen,
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <AuthPage>
      <ForgotPasswordForm />
    </AuthPage>
  )
}
