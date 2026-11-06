import { create } from 'zustand'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

// Storage can throw (private windows, blocked site data): the theme then lasts for this tab only.
function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

// "Nothing stored" would read as "never chosen" when storage is blocked, so keep the choice here too.
let chosenInThisTab = false

function getSystemTheme(): Theme {
  return media.matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

type ThemeState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// A store, not local state: several toggles can be mounted at once and must not drift apart.
export const useTheme = create<ThemeState>((set, get) => ({
  theme: getStoredTheme() ?? getSystemTheme(),
  setTheme: (theme) => {
    chosenInThisTab = true
    storeTheme(theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))

applyTheme(useTheme.getState().theme)

media.addEventListener('change', () => {
  if (chosenInThisTab || getStoredTheme()) return
  const theme = getSystemTheme()
  applyTheme(theme)
  useTheme.setState({ theme })
})
