import type { ParseKeys } from 'i18next'
import type { ComponentType } from 'react'

// The shell gives a game screen these three things and nothing else (AC-52). Anything else a
// game needs, it finds out itself.
export type GameScreenProps = {
  slug: string
  // The puzzle day as YYYY-MM-DD, in UTC.
  date: string
  isToday: boolean
}

// A game's screen. `reload` is there for a screen built with `lazyWithRetry`: it makes the
// next render download the code again after a failed download.
export type GameScreenComponent = ComponentType<GameScreenProps> & {
  reload?: () => void
}

// What a game gives the shell (AC-49). Adding a game is adding one entry to the registry.
export type GameEntry = {
  // The stable address of the game: /games/{slug}.
  slug: string
  // Catalogue key of the game's name; it must exist in both languages.
  nameKey: ParseKeys
  // Position in the navigation.
  order: number
  // The game that `/` shows.
  isDefault: boolean
  // Loaded only when the game is opened (AC-53).
  screen: GameScreenComponent
}
