import { lazyWithRetry } from './lazy-with-retry'
import type { GameEntry } from './types'

// The games the frontend can open: their screens, names, order and the default. The backend decides
// which of them are enabled (`GET /v1/games`), and the nav shows the ones both sides know
// (`known-games.ts`).
export const GAMES: readonly GameEntry[] = [
  {
    slug: 'game-guesser',
    nameKey: 'games.game_guesser.name',
    order: 1,
    isDefault: true,
    screen: lazyWithRetry(() => import('./game-guesser/placeholder-screen')),
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
