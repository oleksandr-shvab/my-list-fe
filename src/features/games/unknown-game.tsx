import { NotFoundMessage } from '@/components/error-screen'

// The "not found" screen of a game page and of the home page: the game is not known to both sides.
export function UnknownGame() {
  return (
    <NotFoundMessage
      titleKey="games.unknown_game"
      textKey="games.unknown_game_text"
    />
  )
}
