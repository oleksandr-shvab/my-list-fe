import { createFileRoute } from '@tanstack/react-router'
import { ListChecks, Sparkles, UserRound } from 'lucide-react'

import { QuickActionCard } from '@/components/quick-action-card'
import { useAuthStore } from '@/features/auth/store'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

function HomePage() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-2xl font-medium">
          Welcome back{user ? `, ${user.email}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s a quick jumping-off point for what you can do next.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionCard
          to="/lists"
          icon={ListChecks}
          title="Your lists"
          description="Browse and manage the lists you've created."
          style={{ animationDelay: '75ms' }}
        />
        <QuickActionCard
          to="/profile"
          icon={UserRound}
          title="Profile"
          description="Update your account details and password."
          style={{ animationDelay: '150ms' }}
        />
        <QuickActionCard
          to="/lists"
          icon={Sparkles}
          title="Start something new"
          description="Create a new list to start tracking items."
          style={{ animationDelay: '225ms' }}
        />
      </div>
    </div>
  )
}
