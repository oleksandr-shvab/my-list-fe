import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <h1 className="text-2xl font-medium">Home</h1>
      <p className="text-muted-foreground">Nothing here yet.</p>
    </div>
  )
}
