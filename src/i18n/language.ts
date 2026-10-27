export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'language'

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value)
}

// The saved choice first, then the browser's languages (the first English or Russian one wins),
// then English. Storage can throw (private windows, blocked site data): the app works without it.
export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // ignore
  }
  const browserLanguages =
    typeof navigator === 'undefined'
      ? []
      : (navigator.languages ?? [navigator.language])
  for (const tag of browserLanguages) {
    const base = tag?.toLowerCase().split('-')[0]
    if (isLanguage(base)) return base
  }
  return 'en'
}

export function persistLanguage(language: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // ignore
  }
}
