import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '@/features/auth/components/login-form'
import { AuthPage } from '@/features/auth/components/auth-page'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/login')({
  staticData: { pageTitle: 'auth.login.title' },
  beforeLoad: () => {
    if (useAuthStore.getState().status === 'authenticated') {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <AuthPage>
      <LoginForm />
    </AuthPage>
  )
}
