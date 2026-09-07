import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle({
  variant = 'outline',
  size = 'icon',
  ...props
}: React.ComponentProps<typeof Button>) {
  const { theme, toggleTheme } = useTheme()
  const label =
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

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
