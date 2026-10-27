import { createFileRoute, redirect } from '@tanstack/react-router'
import { RegisterForm } from '@/features/auth/components/register-form'
import { AuthPage } from '@/features/auth/components/auth-page'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    if (useAuthStore.getState().status === 'authenticated') {
      throw redirect({ to: '/' })
    }
  },
  component: RegisterPage,
})

function RegisterPage() {
  return (
    <AuthPage>
      <RegisterForm />
    </AuthPage>
  )
}
