import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/lists')({
  component: ListsPage,
})

function ListsPage() {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <h1 className="text-2xl font-medium">Lists</h1>
      <p className="text-muted-foreground">Nothing here yet.</p>
    </div>
  )
}
