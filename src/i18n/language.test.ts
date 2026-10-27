import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectLanguage } from './language'

function stubBrowser(options: { saved?: string | null; languages?: string[] }) {
  vi.stubGlobal('localStorage', {
    getItem: () => options.saved ?? null,
    setItem: () => undefined,
  })
  vi.stubGlobal('navigator', { languages: options.languages ?? ['en-US'] })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectLanguage', () => {
  it('prefers the saved choice', () => {
    stubBrowser({ saved: 'ru', languages: ['en-US'] })

    expect(detectLanguage()).toBe('ru')
  })

  it('uses the first supported browser language', () => {
    stubBrowser({ languages: ['uk-UA', 'ru-RU', 'en-US'] })

    expect(detectLanguage()).toBe('ru')
  })

  it('falls back to English, also when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })
    vi.stubGlobal('navigator', { languages: ['de-DE'] })

    expect(detectLanguage()).toBe('en')
  })
})
