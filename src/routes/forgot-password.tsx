import { createFileRoute, redirect } from '@tanstack/react-router'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'
import { AuthPage } from '@/features/auth/components/auth-page'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/forgot-password')({
  staticData: { pageTitle: 'auth.forgot.title' },
  beforeLoad: () => {
    if (useAuthStore.getState().status === 'authenticated') {
      throw redirect({ to: '/' })
    }
  },
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <AuthPage>
      <ForgotPasswordForm />
    </AuthPage>
  )
}
