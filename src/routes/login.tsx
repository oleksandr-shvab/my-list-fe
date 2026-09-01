import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '@/features/auth/components/login-form'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (useAuthStore.getState().status === 'authenticated') {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <LoginForm />
    </div>
  )
}
