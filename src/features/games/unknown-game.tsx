import { NotFoundMessage } from '@/components/error-screen'

export function UnknownGame() {
  return (
    <NotFoundMessage
      titleKey="games.unknown_game"
      textKey="games.unknown_game_text"
    />
  )
}
