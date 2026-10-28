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
    }
  })
})
