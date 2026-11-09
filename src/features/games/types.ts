import type { ParseKeys } from 'i18next'
import type { ComponentType } from 'react'

// The shell gives a game screen these two things and nothing else. `date` is null on today's pages: the
// screen asks the server for today and takes the date from the answer, never from the device's clock.
export type GameScreenProps = {
  slug: string
  date: string | null
}

// `reload` makes a screen built with `lazyWithRetry` download its code again after a failed download.
export type GameScreenComponent = ComponentType<GameScreenProps> & {
  reload?: () => void
}

export type GameEntry = {
  slug: string
  // Catalogue key of the name; it must exist in both languages.
  nameKey: ParseKeys
  order: number
  isDefault: boolean
  // Loaded only when the game is opened (AC-53).
  screen: GameScreenComponent
}
