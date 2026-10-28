import type { ParseKeys } from 'i18next'
import type { ComponentType, LazyExoticComponent } from 'react'

// The shell gives a game screen these three things and nothing else (AC-52). Anything else a
// game needs, it finds out itself.
export type GameScreenProps = {
  slug: string
  // The puzzle day as YYYY-MM-DD, in UTC.
  date: string
  isToday: boolean
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
  screen: LazyExoticComponent<ComponentType<GameScreenProps>>
}
