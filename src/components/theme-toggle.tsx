import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle({
  variant = 'outline',
  size = 'icon',
  ...props
}: React.ComponentProps<typeof Button>) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const label =
    theme === 'dark' ? t('theme.switch_to_light') : t('theme.switch_to_dark')

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      {...props}
      title={label}
      aria-label={label}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
