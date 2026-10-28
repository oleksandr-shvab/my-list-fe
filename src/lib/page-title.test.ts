import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { formatPageTitle, resolvePageTitleKey } from './page-title'

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

describe('resolvePageTitleKey', () => {
  it('takes the key of the deepest match that has one', () => {
    expect(
      resolvePageTitleKey([
        { status: 'success', staticData: {} },
        { status: 'success', staticData: { pageTitle: 'nav.home' } },
        { status: 'success', staticData: { pageTitle: 'profile.title' } },
      ]),
    ).toBe('profile.title')
  })

  it('skips matches without a key and gives nothing when none has one', () => {
    expect(
      resolvePageTitleKey([
        { status: 'success', staticData: { pageTitle: 'profile.title' } },
        { status: 'success', staticData: {} },
      ]),
    ).toBe('profile.title')
    expect(
      resolvePageTitleKey([{ status: 'success', staticData: {} }]),
    ).toBeUndefined()
  })

  it('uses the "not found" title when any match is not found', () => {
    expect(
      resolvePageTitleKey([
        { status: 'success', staticData: { pageTitle: 'app.tagline' } },
        { status: 'notFound', staticData: {} },
      ]),
    ).toBe('error_screen.not_found_title')
  })
})
