import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import { GAMES, findGame, getDefaultGame, getGamesInOrder } from './registry'
import { validateRegistry } from './validate-registry'

const catalogues = { en, ru }

// A registry entry as the checks see it. The keys are made up, so the fixtures need their own
// catalogues.
function entry(
  overrides: Partial<Parameters<typeof validateRegistry>[0][number]> = {},
) {
  return {
    slug: 'alpha',
    nameKey: 'games.alpha.name',
    order: 1,
    isDefault: true,
    ...overrides,
  }
}

const fixtureCatalogues = {
  en: { games: { alpha: { name: 'Alpha' }, beta: { name: 'Beta' } } },
  ru: { games: { alpha: { name: 'Альфа' }, beta: { name: 'Бета' } } },
}

const beta = () =>
  entry({
    slug: 'beta',
    nameKey: 'games.beta.name',
    order: 2,
    isDefault: false,
  })

describe('the game registry (AC-49 to AC-53, AC-56)', () => {
  it('is valid in both languages', () => {
    expect(validateRegistry(GAMES, catalogues)).toEqual([])
  })

  it('holds the game guesser as the only and default game, with a lazy screen', () => {
    expect(GAMES).toHaveLength(1)
    expect(GAMES[0]).toMatchObject({
      slug: 'game-guesser',
      nameKey: 'games.game_guesser.name',
      order: 1,
      isDefault: true,
    })
    // Only the five items of the contract (AC-49).
    expect(Object.keys(GAMES[0]).sort()).toEqual([
      'isDefault',
      'nameKey',
      'order',
      'screen',
      'slug',
    ])
    // The screen comes from `lazyWithRetry`; that it loads only on render is checked in
    // game-screen.test.tsx (the "Loading the game…" status shows first).
    for (const game of GAMES) {
      expect(typeof game.screen).toBe('function')
      expect(typeof game.screen.reload).toBe('function')
    }
  })

  it('finds a game by its exact slug and gives the default and the order', () => {
    expect(findGame('game-guesser')).toBe(GAMES[0])
    expect(findGame('Game-Guesser')).toBeUndefined()
    expect(findGame('nope')).toBeUndefined()
    expect(getDefaultGame()).toBe(GAMES[0])
    expect(getGamesInOrder()).toEqual([...GAMES])
  })
})

describe('validateRegistry (AC-50, AC-51)', () => {
  it('accepts a registry with one default, good slugs and names in both languages', () => {
    expect(validateRegistry([entry(), beta()], fixtureCatalogues)).toEqual([])
  })

  it('fails with no default game or with two', () => {
    expect(
      validateRegistry([entry({ isDefault: false })], fixtureCatalogues),
    ).toEqual(['expected exactly one default game, found 0'])
    expect(
      validateRegistry(
        [entry(), { ...beta(), isDefault: true }],
        fixtureCatalogues,
      ),
    ).toEqual(['expected exactly one default game, found 2'])
  })

  it.each([
    'Game-Guesser',
    'game--guesser',
    '-game',
    'game-',
    'game guesser',
    'game_guesser',
    '',
  ])('fails for the slug "%s"', (slug) => {
    const problems = validateRegistry([entry({ slug })], fixtureCatalogues)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('does not match')
  })

  it('fails for a repeated slug and a repeated order', () => {
    expect(
      validateRegistry(
        [entry(), { ...beta(), slug: 'alpha' }],
        fixtureCatalogues,
      ),
    ).toEqual(['slug "alpha" is used more than once'])
    expect(
      validateRegistry([entry(), { ...beta(), order: 1 }], fixtureCatalogues),
    ).toEqual(['order 1 is used more than once'])
  })

  it('fails when a name key is missing in one of the languages', () => {
    const withoutRussian = {
      ...fixtureCatalogues,
      ru: { games: { alpha: { name: 'Альфа' } } },
    }

    expect(validateRegistry([entry(), beta()], withoutRussian)).toEqual([
      'name key "games.beta.name" of "beta" is missing in "ru"',
    ])
  })
})
