import { createFileRoute, redirect } from '@tanstack/react-router'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: () => {
    if (useAuthStore.getState().status === 'authenticated') {
      throw redirect({ to: '/' })
    }
  },
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <ForgotPasswordForm />
    </div>
  )
}
