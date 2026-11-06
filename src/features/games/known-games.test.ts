import { describe, expect, it } from 'vitest'
import { findKnownGame, isDefaultKnown, knownGames } from './known-games'
import type { GameEntry } from './types'

const stubScreen = () => null
const FIXTURE: readonly GameEntry[] = [
  {
    slug: 'second',
    nameKey: 'games.game_guesser.name',
    order: 2,
    isDefault: false,
    screen: stubScreen,
  },
  {
    slug: 'first',
    nameKey: 'games.game_guesser.name',
    order: 1,
    isDefault: true,
    screen: stubScreen,
  },
]

const slugsOfGames = (games: GameEntry[]) => games.map((game) => game.slug)

describe('knownGames (AC-7, AC-8)', () => {
  it('gives the whole registry when the list is not known', () => {
    expect(slugsOfGames(knownGames(undefined, FIXTURE))).toEqual([
      'first',
      'second',
    ])
  })

  it('keeps only the games both sides know, in `order`', () => {
    expect(
      slugsOfGames(knownGames(new Set(['second', 'first']), FIXTURE)),
    ).toEqual(['first', 'second'])
    expect(slugsOfGames(knownGames(new Set(['second']), FIXTURE))).toEqual([
      'second',
    ])
  })

  it('gives nothing for an empty list, or for a list with only games the registry lacks', () => {
    expect(knownGames(new Set(), FIXTURE)).toEqual([])
    expect(knownGames(new Set(['word-game']), FIXTURE)).toEqual([])
  })

  it('reads the real registry by default', () => {
    expect(slugsOfGames(knownGames(undefined))).toEqual(['game-guesser'])
    expect(slugsOfGames(knownGames(new Set(['game-guesser'])))).toEqual([
      'game-guesser',
    ])
  })
})

describe('findKnownGame', () => {
  it('finds a registry game that the list has, or when the list is not known', () => {
    expect(findKnownGame('game-guesser', undefined)?.slug).toBe('game-guesser')
    expect(findKnownGame('game-guesser', new Set(['game-guesser']))?.slug).toBe(
      'game-guesser',
    )
  })

  it('does not find a game the list lacks, or one the registry lacks', () => {
    expect(findKnownGame('game-guesser', new Set())).toBeUndefined()
    expect(findKnownGame('word-game', new Set(['word-game']))).toBeUndefined()
    expect(findKnownGame('word-game', undefined)).toBeUndefined()
  })

  it('matches the slug exactly', () => {
    expect(findKnownGame('Game-Guesser', undefined)).toBeUndefined()
  })
})

describe('isDefaultKnown', () => {
  it('is true when the list is not known or has the default game', () => {
    expect(isDefaultKnown(undefined)).toBe(true)
    expect(isDefaultKnown(new Set(['game-guesser', 'word-game']))).toBe(true)
  })

  it('is false for an empty list or a list without the default game', () => {
    expect(isDefaultKnown(new Set())).toBe(false)
    expect(isDefaultKnown(new Set(['word-game']))).toBe(false)
  })
})
