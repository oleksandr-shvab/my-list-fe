import { createFileRoute, redirect } from '@tanstack/react-router'
import { RegisterForm } from '@/features/auth/components/register-form'
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
    <div className="flex min-h-svh items-center justify-center px-6">
      <RegisterForm />
    </div>
  )
}
