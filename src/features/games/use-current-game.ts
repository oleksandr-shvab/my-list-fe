import { useMatches } from '@tanstack/react-router'
import { findGame, getDefaultGame } from './registry'
import type { GameEntry } from './types'

type CurrentGameMatch = {
  routeId: string
  status: string
  params: Record<string, string | undefined>
}

export type CurrentGame = {
  // The game the page shows. None on pages that are not a game (profile, "not found").
  game: GameEntry | undefined
  // The archive page of that game is open.
  archiveOpen: boolean
}

const NO_GAME: CurrentGame = { game: undefined, archiveOpen: false }

// Which game the visitor is looking at: the game of the `slug` in the address, or the default game
// on the home page. A "not found" page shows no game, even when its slug is a real one.
export function resolveCurrentGame(
  matches: readonly CurrentGameMatch[],
): CurrentGame {
  if (matches.some((match) => match.status === 'notFound')) return NO_GAME

  const slug = matches.find((match) => match.params.slug !== undefined)?.params
    .slug
  const onHome = matches.some((match) => match.routeId === '/_app/')
  const game =
    slug !== undefined ? findGame(slug) : onHome ? getDefaultGame() : undefined
  if (!game) return NO_GAME

  return {
    game,
    archiveOpen: matches.some(
      (match) => match.routeId === '/_app/games/$slug/archive',
    ),
  }
}

export function useCurrentGame(): CurrentGame {
  return useMatches({ select: resolveCurrentGame })
}
