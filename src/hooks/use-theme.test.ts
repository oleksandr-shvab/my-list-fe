import { afterEach, describe, expect, it, vi } from 'vitest'

// The theme store reads `window.matchMedia` and `localStorage` when it is first imported, so each
// test stubs the browser and then imports a fresh copy of the module.
async function startWithBlockedStorage({
  systemIsDark,
}: {
  systemIsDark: boolean
}) {
  let onSystemChange = () => {}
  const media = {
    matches: systemIsDark,
    addEventListener: (_type: string, listener: () => void) => {
      onSystemChange = listener
    },
  }
  const blocked = () => {
    throw new Error('storage is blocked')
  }
  vi.stubGlobal('window', { matchMedia: () => media })
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
  vi.stubGlobal('document', {
    documentElement: { classList: { toggle: vi.fn() } },
  })

  vi.resetModules()
  const { useTheme } = await import('./use-theme')

  return {
    useTheme,
    changeSystemTheme(isDark: boolean) {
      media.matches = isDark
      onSystemChange()
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useTheme with browser storage blocked (AC-68)', () => {
  it('follows the system theme until the user picks one', async () => {
    const { useTheme, changeSystemTheme } = await startWithBlockedStorage({
      systemIsDark: false,
    })
    expect(useTheme.getState().theme).toBe('light')

    changeSystemTheme(true)

    expect(useTheme.getState().theme).toBe('dark')
  })

  it('keeps the theme the user picked when the system theme changes', async () => {
    const { useTheme, changeSystemTheme } = await startWithBlockedStorage({
      systemIsDark: true,
    })

    useTheme.getState().setTheme('dark')
    changeSystemTheme(false)

    expect(useTheme.getState().theme).toBe('dark')

    useTheme.getState().toggleTheme()
    changeSystemTheme(true)

    expect(useTheme.getState().theme).toBe('light')
  })
})
