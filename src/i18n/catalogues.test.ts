import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ru from './locales/ru.json'

type Tree = { [key: string]: string | Tree }

// Plural forms differ by language (_one/_other in English, also _few/_many in Russian), so
// compare the keys without the plural suffix.
function baseKeys(tree: Tree, prefix = ''): Set<string> {
  const keys = new Set<string>()
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') {
      keys.add(prefix + key.replace(/_(zero|one|two|few|many|other)$/, ''))
    } else {
      for (const nested of baseKeys(value, `${prefix}${key}.`)) keys.add(nested)
    }
  }
  return keys
}

// Add a code here when the backend adds one (CONTRACTS.md, Errors). `method_not_allowed` is left
// out on purpose: it is a client bug, never shown to a player.
const BACKEND_ERROR_CODES = [
  'email_already_registered',
  'invalid_credentials',
  'not_authenticated',
  'invalid_or_expired_reset_token',
  'incorrect_password',
  'passwords_do_not_match',
  'new_password_same_as_old',
  'validation_error',
  'not_found',
  'csrf_origin_mismatch',
  'unsupported_media_type',
  'service_unavailable',
  'internal_error',
  'game_not_found',
  'variant_not_found',
  'puzzle_not_found',
  'title_not_found',
  'duplicate_guess',
  'invalid_guess_history',
  'puzzle_already_finished',
  'invalid_media_link',
]

function allValues(tree: Tree): string[] {
  return Object.values(tree).flatMap((value) =>
    typeof value === 'string' ? [value] : allValues(value),
  )
}

describe('translation catalogues', () => {
  it('have the same keys in English and Russian', () => {
    const english = baseKeys(en)
    const russian = baseKeys(ru)

    expect([...english].filter((key) => !russian.has(key))).toEqual([])
    expect([...russian].filter((key) => !english.has(key))).toEqual([])
  })

  it('have a text for every backend error code', () => {
    for (const catalogue of [en, ru]) {
      const missing = BACKEND_ERROR_CODES.filter(
        (code) => !(code in catalogue.errors),
      )
      expect(missing).toEqual([])
    }
  })

  it('give every Russian plural key all four forms', () => {
    const pluralBases = Object.keys(ru.errors)
      .filter((key) => key.endsWith('_one'))
      .map((key) => key.slice(0, -4))

    for (const base of pluralBases) {
      for (const form of ['one', 'few', 'many', 'other']) {
        expect(ru.errors).toHaveProperty(`${base}_${form}`)
      }
    }
  })

  it('never name the old product', () => {
    expect(allValues(en).filter((text) => /mylist/i.test(text))).toEqual([])
    expect(allValues(ru).filter((text) => /mylist/i.test(text))).toEqual([])
  })

  it('have no texts of the removed Lists and old home pages', () => {
    for (const catalogue of [en, ru]) {
      expect(catalogue).not.toHaveProperty('lists')
      expect(catalogue).not.toHaveProperty('home')
      expect(catalogue.nav).not.toHaveProperty('lists')
      expect(catalogue.nav).not.toHaveProperty('home')
    }
  })
})
