import { createFileRoute } from '@tanstack/react-router'

import { ThemeToggle } from '@/components/theme-toggle'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function ProfilePage() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-medium">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your MyList account details.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Row label="Email">
            <span className="truncate text-sm">{user?.email}</span>
          </Row>
          <Separator />
          <Row label="Member since">
            <span className="text-sm">
              {user
                ? new Date(user.created_at).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })
                : '—'}
            </span>
          </Row>
          <Separator />
          <Row label="Theme">
            <ThemeToggle />
          </Row>
        </CardContent>
      </Card>
    </div>
  )
}
