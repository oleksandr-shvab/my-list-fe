import { LanguageSwitcher } from '@/components/language-switcher'

// Shared frame of the signed-out pages: a centred card and the language switcher.
export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-6">
      <LanguageSwitcher className="absolute end-4 top-4" />
      {children}
    </div>
  )
}
