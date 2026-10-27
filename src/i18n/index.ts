import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { detectLanguage, persistLanguage } from './language'
import en from './locales/en.json'
import ru from './locales/ru.json'

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru } },
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'ru'],
  // React escapes output itself.
  interpolation: { escapeValue: false },
})

function applyLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language
  }
}

applyLanguage(i18n.language)
i18n.on('languageChanged', (language) => {
  applyLanguage(language)
  persistLanguage(language)
})

export default i18n
