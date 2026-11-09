import { NotFoundMessage } from '@/components/error-screen'

// The backend has no visible puzzle for the date in the address (AC-4); the player may have mistyped it.
export function NoPuzzle() {
  return (
    <NotFoundMessage
      titleKey="games.no_puzzle"
      textKey="games.no_puzzle_text"
    />
  )
}

// The same for a page with no date in its address. There is nothing to fix, and a link to "today" would lead back here.
export function NoPuzzleToday() {
  return (
    <NotFoundMessage
      titleKey="games.no_puzzle_today"
      textKey="games.no_puzzle_today_text"
      showHomeLink={false}
    />
  )
}
