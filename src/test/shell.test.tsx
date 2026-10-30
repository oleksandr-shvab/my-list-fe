// @vitest-environment jsdom
import './dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import {
  GUEST,
  SIGNED_IN,
  slowReply,
  startApp,
  USER,
  type Reply,
} from './router-harness'

// The navigation shell in jsdom: the sidebar, the phone header and panel, the skip link and the
// account menu, on the real route tree with the fake backend. The fixed day makes "today"
// 2026-10-28 in UTC.

let stop: (() => void) | undefined

function renderApp(path: string, me: Reply) {
  const app = startApp({ path, me })
  stop = app.stop
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

// Below 768 px: the sidebar is a panel and the slim header shows. Matches `use-mobile.ts`.
function usePhoneScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
  await i18n.changeLanguage('en')
})

afterEach(async () => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

const GAMES_NAV = { name: 'Games' }

describe('the current game in the sidebar (AC-30)', () => {
  it.each([['/'], ['/games/game-guesser'], ['/games/game-guesser/2026-10-01']])(
    'marks exactly one entry, the game, on %s',
    async (path) => {
      renderApp(path, GUEST)

      const nav = await screen.findByRole('navigation', GAMES_NAV)
      const current = within(nav).getAllByRole('link', { current: 'page' })
      expect(current.map((link) => link.textContent)).toEqual(['Game Guesser'])
      expect(current[0].getAttribute('href')).toBe('/games/game-guesser')
      expect(
        within(nav).getByRole('link', { name: 'Archive' }).getAttribute('href'),
      ).toBe('/games/game-guesser/archive')
    },
  )

  it('marks the archive link, not the game entry, on the archive page, and nothing on the profile page', async () => {
    const user = userEvent.setup()
    renderApp('/games/game-guesser/archive', SIGNED_IN)

    const nav = await screen.findByRole('navigation', GAMES_NAV)
    expect(
      within(nav)
        .getAllByRole('link', { current: 'page' })
        .map((link) => link.textContent),
    ).toEqual(['Archive'])
    expect(
      within(nav)
        .getByRole('link', { name: 'Game Guesser' })
        .getAttribute('aria-current'),
    ).toBeNull()

    // A page that is not a game shows no current game, and the archive link keeps the default.
    await user.click(
      await screen.findByRole('button', { name: `Account: ${USER.email}` }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Profile' }))
    await screen.findByRole('heading', { name: 'Profile' })
    expect(within(nav).queryAllByRole('link', { current: 'page' })).toEqual([])
    expect(
      within(nav).getByRole('link', { name: 'Archive' }).getAttribute('href'),
    ).toBe('/games/game-guesser/archive')
  })
})

describe('the game list in the sidebar (AC-30)', () => {
  it('scrolls its own list to the current game and never scrolls the page', async () => {
    // jsdom has no layout: the list is 100 px high and the current entry sticks out 34 px below.
    const box = (top: number, bottom: number) =>
      ({
        top,
        bottom,
        left: 0,
        right: 0,
        width: 0,
        height: bottom - top,
      }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset.slot === 'sidebar-content') return box(0, 100)
        if (this.dataset.slot === 'sidebar-menu-item') return box(90, 134)
        return box(0, 0)
      },
    )
    const scrollIntoView = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    try {
      renderApp('/', GUEST)

      const nav = await screen.findByRole('navigation', GAMES_NAV)
      const list = nav.querySelector<HTMLElement>(
        '[data-slot="sidebar-content"]',
      )
      expect(list?.scrollTop).toBe(34)
      expect(scrollIntoView).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })
})

describe('the account menu (AC-33, AC-66)', () => {
  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
    ['Arrow Down', '{ArrowDown}'],
  ])(
    'opens with %s, offers Profile and Log out, and Escape closes it with the focus back on its button',
    async (_name, key) => {
      const user = userEvent.setup()
      renderApp('/', SIGNED_IN)

      const button = await screen.findByRole('button', {
        name: `Account: ${USER.email}`,
      })
      expect(screen.queryByRole('menu')).toBeNull()

      act(() => button.focus())
      await user.keyboard(key)

      const menu = await screen.findByRole('menu')
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent),
      ).toEqual(['Profile', 'Log out'])

      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(button))
    },
  )
})

describe('logging out from the account menu (AC-33, AC-66)', () => {
  const LOGOUT_URL = '/v1/auth/logout'

  // Starts signed in with a logout that does not answer until the test says so.
  function renderWithHeldLogout(path = '/') {
    const held = slowReply()
    const app = renderApp(path, SIGNED_IN)
    app.backend.replies.set(LOGOUT_URL, held.reply)
    return { held, app }
  }

  it.each(['the sidebar', 'the phone header', 'the phone panel'] as const)(
    'shows the pending state on the menu button of %s, then puts the focus on Log in',
    async (place) => {
      const user = userEvent.setup()
      if (place !== 'the sidebar') usePhoneScreen()
      const { held, app } = renderWithHeldLogout()
      let area: Pick<typeof screen, 'findByRole'> = screen
      if (place === 'the phone header') {
        area = within(await screen.findByRole('banner'))
      } else if (place === 'the phone panel') {
        await user.click(
          await screen.findByRole('button', {
            name: 'Show or hide the sidebar',
          }),
        )
        area = within(await screen.findByRole('dialog', { name: 'Site menu' }))
      }

      await user.click(
        await area.findByRole('button', {
          name: `Account: ${USER.email}`,
        }),
      )
      await user.click(await screen.findByRole('menuitem', { name: 'Log out' }))

      // The menu closes on select, so the pending state is on the button that opened it.
      const pending = await area.findByRole('button', {
        name: 'Logging out…',
      })
      expect((pending as HTMLButtonElement).disabled).toBe(true)
      expect(pending.getAttribute('aria-busy')).toBe('true')
      expect(screen.queryByRole('menu')).toBeNull()
      expect(app.backend.count(LOGOUT_URL)).toBe(1)

      await act(async () => held.answer({ status: 204 }))

      const logIn = await area.findByRole('link', { name: 'Log in' })
      await waitFor(() => expect(document.activeElement).toBe(logIn))
    },
  )
})

describe('the skip link and the order of the sidebar (AC-27a, AC-62)', () => {
  it('is the first thing Tab reaches, shows only when focused, and moves the focus to the main area', async () => {
    const user = userEvent.setup()
    const app = renderApp('/', GUEST)
    await screen.findByRole('link', { name: 'Log in' })

    await user.tab()

    const skipLink = screen.getByRole('link', { name: 'Skip to content' })
    expect(document.activeElement).toBe(skipLink)

    await user.keyboard('{Enter}')

    expect(document.activeElement).toBe(screen.getByRole('main'))
    // The jump is ours: the address does not get a `#main`.
    expect(window.location.hash).toBe('')
    expect(app.router.state.location.hash).toBe('')
  })

  it('leads through the brand, the game, the archive, the language, the theme, the account and the toggle', async () => {
    const user = userEvent.setup()
    renderApp('/', GUEST)
    await screen.findByRole('link', { name: 'Log in' })

    const names: string[] = []
    for (let step = 0; step < 10; step++) {
      await user.tab()
      const element = document.activeElement as HTMLElement
      names.push(element.getAttribute('aria-label') ?? element.textContent)
    }

    expect(names).toEqual([
      'Skip to content',
      'Daily Game Challenge',
      'Game Guesser',
      'Archive',
      'EN',
      'RU',
      expect.stringMatching(/^Switch to (dark|light) mode$/),
      'Log in',
      'Sign up',
      'Show or hide the sidebar',
    ])
  })
})

describe('the landmarks (AC-63)', () => {
  it('has one main area and a navigation named Games, and no banner beside the sidebar', async () => {
    renderApp('/', GUEST)

    const nav = await screen.findByRole('navigation', GAMES_NAV)
    expect(screen.getAllByRole('navigation')).toEqual([nav])
    expect(nav.getAttribute('aria-label')).not.toMatch(/navigation/i)
    const main = screen.getByRole('main')
    expect(screen.getAllByRole('main')).toEqual([main])
    expect(main.contains(nav)).toBe(false)
    expect(
      within(main).getByRole('heading', { level: 1, name: 'Game Guesser' }),
    ).toBeTruthy()
    expect(screen.queryByRole('banner')).toBeNull()

    await act(() => i18n.changeLanguage('ru'))
    expect(screen.getByRole('navigation', { name: 'Игры' })).toBe(nav)
  })

  it('makes the phone header the banner, outside the main area', async () => {
    usePhoneScreen()
    renderApp('/', GUEST)

    const banner = await screen.findByRole('banner')
    const main = screen.getByRole('main')
    expect(screen.getAllByRole('main')).toEqual([main])
    expect(main.contains(banner)).toBe(false)
    // The sidebar is a panel on a phone, so its navigation is not there while it is closed.
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})

describe('the phone header and panel (AC-32, AC-35, AC-66)', () => {
  it('shows the sidebar button, the brand and Log in; the panel keeps the focus, closes on Escape and gives the focus back to the button', async () => {
    const user = userEvent.setup()
    usePhoneScreen()
    renderApp('/games/game-guesser', GUEST)

    const banner = await screen.findByRole('banner')
    const logIn = await within(banner).findByRole('link', { name: 'Log in' })
    expect(logIn.getAttribute('href')).toBe(
      `/login?redirect=${encodeURIComponent('/games/game-guesser')}`,
    )
    expect(
      within(banner).getByRole('link', { name: 'Daily Game Challenge' }),
    ).toBeTruthy()
    const toggle = within(banner).getByRole('button', {
      name: 'Show or hide the sidebar',
    })
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(toggle)

    const panel = await screen.findByRole('dialog', { name: 'Site menu' })
    expect(within(panel).getByRole('navigation', GAMES_NAV)).toBeTruthy()
    expect(panel.contains(document.activeElement)).toBe(true)
    // The panel's hidden title follows the language.
    await act(() => i18n.changeLanguage('ru'))
    expect(screen.getByRole('dialog', { name: 'Меню сайта' })).toBe(panel)
    await act(() => i18n.changeLanguage('en'))

    // Tab and Shift+Tab walk around the panel and never leave it.
    for (let step = 0; step < 14; step++) {
      await user.tab()
      expect(panel.contains(document.activeElement)).toBe(true)
    }
    for (let step = 0; step < 4; step++) {
      await user.tab({ shift: true })
      expect(panel.contains(document.activeElement)).toBe(true)
    }

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(toggle)
  })

  it('puts the focus on the main area when a link in the panel closes it, and back on the button when Escape does', async () => {
    const user = userEvent.setup()
    usePhoneScreen()
    const app = renderApp('/games/game-guesser', GUEST)

    const banner = await screen.findByRole('banner')
    const toggle = within(banner).getByRole('button', {
      name: 'Show or hide the sidebar',
    })

    await user.click(toggle)
    const panel = await screen.findByRole('dialog', { name: 'Site menu' })
    await user.click(within(panel).getByRole('link', { name: 'Archive' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(app.router.state.location.pathname).toBe(
        '/games/game-guesser/archive',
      ),
    )
    expect(document.activeElement).toBe(screen.getByRole('main'))

    await user.click(toggle)
    await screen.findByRole('dialog', { name: 'Site menu' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(toggle)
  })

  it('leaves the panel open and the focus where it was when a link is opened with a modifier key', async () => {
    const user = userEvent.setup()
    usePhoneScreen()
    const app = renderApp('/', SIGNED_IN)
    // The browser opens a modified click in a new tab; jsdom would only print "not implemented".
    const keepPage = (event: Event) => event.preventDefault()
    document.addEventListener('click', keepPage)

    try {
      await user.click(
        await screen.findByRole('button', { name: 'Show or hide the sidebar' }),
      )
      const panel = await screen.findByRole('dialog', { name: 'Site menu' })

      await user.keyboard('{Control>}')
      await user.click(within(panel).getByRole('link', { name: 'Archive' }))
      await user.keyboard('{/Control}')

      expect(screen.queryByRole('dialog')).toBe(panel)
      expect(panel.getAttribute('data-state')).toBe('open')
      expect(app.router.state.location.pathname).toBe('/')

      // The same goes for Profile in the account menu: the menu closes, the panel stays.
      const accountButton = within(panel).getByRole('button', {
        name: `Account: ${USER.email}`,
      })
      await user.click(accountButton)
      await user.keyboard('{Control>}')
      await user.click(await screen.findByRole('menuitem', { name: 'Profile' }))
      await user.keyboard('{/Control}')

      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(panel.getAttribute('data-state')).toBe('open')
      await waitFor(() => expect(document.activeElement).toBe(accountButton))
      expect(app.router.state.location.pathname).toBe('/')
    } finally {
      document.removeEventListener('click', keepPage)
    }
  })

  it('keeps the focus on the main area after Profile is chosen from the account menu inside the closing panel', async () => {
    const user = userEvent.setup()
    usePhoneScreen()
    // jsdom has no animations, so the panel would vanish at once and take its menu button with
    // it. The real panel plays an exit animation first and stays in the page while it runs, so
    // give it one, and end it by hand.
    const realGetComputedStyle = window.getComputedStyle
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    vi.stubGlobal('getComputedStyle', (element: Element) => {
      const styles = realGetComputedStyle(element)
      if (element.getAttribute('role') !== 'dialog') return styles
      return new Proxy(styles, {
        get(target, property) {
          if (property === 'animationName') {
            return element.getAttribute('data-state') === 'closed'
              ? 'sheet-out'
              : 'none'
          }
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    })
    const app = renderApp('/', SIGNED_IN)

    await user.click(
      await screen.findByRole('button', { name: 'Show or hide the sidebar' }),
    )
    const panel = await screen.findByRole('dialog', { name: 'Site menu' })
    await user.click(
      await within(panel).findByRole('button', {
        name: `Account: ${USER.email}`,
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Profile' }))

    await waitFor(() =>
      expect(app.router.state.location.pathname).toBe('/profile'),
    )
    // The panel is closing but still in the page, with the button that had the menu.
    expect(panel.getAttribute('data-state')).toBe('closed')
    expect(panel.isConnected).toBe(true)
    // Let the menu's own focus return (a timer) run.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(document.activeElement).toBe(
      screen.getByRole('main', { hidden: true }),
    )

    const animationEnd = new Event('animationend', { bubbles: true })
    Object.assign(animationEnd, { animationName: 'sheet-out' })
    act(() => {
      panel.dispatchEvent(animationEnd)
    })
    await waitFor(() => expect(panel.isConnected).toBe(false))
    expect(document.activeElement).toBe(
      screen.getByRole('main', { hidden: true }),
    )
  })

  it('shows the account menu button in the header instead of Log in when signed in', async () => {
    usePhoneScreen()
    renderApp('/', SIGNED_IN)

    const banner = await screen.findByRole('banner')
    expect(
      await within(banner).findByRole('button', {
        name: `Account: ${USER.email}`,
      }),
    ).toBeTruthy()
    expect(within(banner).queryByRole('link', { name: 'Log in' })).toBeNull()
  })
})
