import { createFileRoute, redirect } from '@tanstack/react-router'
import { UpdatePasswordForm } from '@/features/auth/components/update-password-form'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/account')({
  beforeLoad: () => {
    if (useAuthStore.getState().status !== 'authenticated') {
      throw redirect({ to: '/login' })
    }
  },
  component: AccountPage,
})

function AccountPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-medium">Account</h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Password</h2>
        <UpdatePasswordForm />
      </section>
    </div>
  )
}
