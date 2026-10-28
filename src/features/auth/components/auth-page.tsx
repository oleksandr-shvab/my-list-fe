import { BrandLink } from '@/components/brand-link'
import { LanguageSwitcher } from '@/components/language-switcher'

// Shared frame of the signed-out pages: a centred card, the brand link at the
// start corner and the language switcher at the end corner.
export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-6">
      <BrandLink className="absolute start-4 top-4 max-w-[60%] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <LanguageSwitcher className="absolute end-4 top-4" />
      {children}
    </div>
  )
}
