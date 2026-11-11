import { createFileRoute } from '@tanstack/react-router'
import { ArchiveList } from '@/features/games/archive/archive-list'

// A static segment wins over `$date`, so this is never read as a date.
export const Route = createFileRoute('/_app/games/$slug/archive')({
  staticData: { pageTitle: 'games.archive_title' },
  component: ArchivePage,
})

function ArchivePage() {
  const { game } = Route.useRouteContext()

  return <ArchiveList slug={game.slug} />
}
