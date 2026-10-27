import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SUPPORTED_LANGUAGES, type Language } from '@/i18n/language'
import { cn } from '@/lib/utils'

const LABELS: Record<Language, string> = { en: 'EN', ru: 'RU' }

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={cn('flex items-center gap-1', className)}
    >
      {SUPPORTED_LANGUAGES.map((language) => (
        <Button
          key={language}
          type="button"
          size="sm"
          variant={i18n.language === language ? 'secondary' : 'ghost'}
          aria-pressed={i18n.language === language}
          lang={language}
          title={t(`language.${language}`)}
          onClick={() => void i18n.changeLanguage(language)}
        >
          {LABELS[language]}
        </Button>
      ))}
    </div>
  )
}
