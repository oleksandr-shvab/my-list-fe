import { create } from 'zustand'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

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

// A store rather than local state: several toggles can be mounted at once
// (sidebar footer and the profile page) and they must not drift apart.
export const useTheme = create<ThemeState>((set, get) => ({
  theme: getStoredTheme() ?? getSystemTheme(),
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))

applyTheme(useTheme.getState().theme)

// Follow the OS only until the user makes an explicit choice.
media.addEventListener('change', () => {
  if (getStoredTheme()) return
  const theme = getSystemTheme()
  applyTheme(theme)
  useTheme.setState({ theme })
})
