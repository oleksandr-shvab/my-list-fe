import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import {
  formatPageTitle,
  GAME_NAME_TITLE,
  resolvePageTitleKey,
} from './page-title'

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('formatPageTitle', () => {
  it('puts the page name before the product name, in both languages', async () => {
    await i18n.changeLanguage('en')
    expect(formatPageTitle(i18n.t('profile.title'), i18n.t('app.name'))).toBe(
      'Profile | Daily Game Challenge',
    )

    await i18n.changeLanguage('ru')
    expect(formatPageTitle(i18n.t('profile.title'), i18n.t('app.name'))).toBe(
      'Профиль | Daily Game Challenge',
    )
  })

  it('shows the product name alone when the page has no name', () => {
    expect(formatPageTitle(undefined, 'Daily Game Challenge')).toBe(
      'Daily Game Challenge',
    )
  })
})

type Match = Parameters<typeof resolvePageTitleKey>[0][number]

// A route match as the resolver reads it.
function match(overrides: Partial<Match> = {}): Match {
  return { status: 'success', params: {}, staticData: {}, ...overrides }
}

describe('resolvePageTitleKey', () => {
  it('takes the key of the deepest match that has one', () => {
    expect(
      resolvePageTitleKey([
        match(),
        match({ staticData: { pageTitle: 'app.tagline' } }),
        match({ staticData: { pageTitle: 'profile.title' } }),
      ]),
    ).toBe('profile.title')
  })

  it('skips matches without a key and gives nothing when none has one', () => {
    expect(
      resolvePageTitleKey([
        match({ staticData: { pageTitle: 'profile.title' } }),
        match(),
      ]),
    ).toBe('profile.title')
    expect(resolvePageTitleKey([match()])).toBeUndefined()
  })

  it('uses the "not found" title when any match is not found', () => {
    expect(
      resolvePageTitleKey([
        match({ staticData: { pageTitle: 'app.tagline' } }),
        match({ status: 'notFound' }),
      ]),
    ).toBe('error_screen.not_found_title')
  })

  it('names a game page after its game (AC-3)', () => {
    // The home page has no slug and shows the default game.
    expect(
      resolvePageTitleKey([
        match({ staticData: { pageTitle: GAME_NAME_TITLE } }),
      ]),
    ).toBe('games.game_guesser.name')
    expect(
      resolvePageTitleKey([
        match({
          params: { slug: 'game-guesser' },
          staticData: { pageTitle: GAME_NAME_TITLE },
        }),
        match({ params: { slug: 'game-guesser', date: '2026-10-01' } }),
      ]),
    ).toBe('games.game_guesser.name')
  })

  it('gives a deeper page its own title, and no name to a slug that is no game', () => {
    expect(
      resolvePageTitleKey([
        match({
          params: { slug: 'game-guesser' },
          staticData: { pageTitle: GAME_NAME_TITLE },
        }),
        match({
          params: { slug: 'game-guesser' },
          staticData: { pageTitle: 'games.archive_title' },
        }),
      ]),
    ).toBe('games.archive_title')
    expect(
      resolvePageTitleKey([
        match({
          params: { slug: 'Game-Guesser' },
          staticData: { pageTitle: GAME_NAME_TITLE },
        }),
      ]),
    ).toBeUndefined()
  })
})
