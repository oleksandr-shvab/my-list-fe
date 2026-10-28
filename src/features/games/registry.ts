import { lazy } from 'react'
import type { GameEntry } from './types'

// The games the shell knows. Phase 1 moves the list to the backend; the shell keeps only the
// screens it can open.
export const GAMES: readonly GameEntry[] = [
  {
    slug: 'game-guesser',
    nameKey: 'games.game_guesser.name',
    order: 1,
    isDefault: true,
    screen: lazy(() => import('./game-guesser/placeholder-screen')),
  },
]

// Slugs are case-sensitive: `Game-Guesser` is not a game.
export function findGame(slug: string): GameEntry | undefined {
  return GAMES.find((game) => game.slug === slug)
}

export function getDefaultGame(): GameEntry {
  const game = GAMES.find((entry) => entry.isDefault)
  if (!game) throw new Error('The game registry has no default game')
  return game
}

export function getGamesInOrder(): GameEntry[] {
  return GAMES.toSorted((a, b) => a.order - b.order)
}
