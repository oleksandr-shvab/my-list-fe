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
})
