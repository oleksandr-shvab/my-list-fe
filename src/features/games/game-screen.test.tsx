// @vitest-environment jsdom
import '@/test/dom-setup'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lazy } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { GameScreen } from './game-screen'
import { lazyWithRetry } from './lazy-with-retry'
import type { GameEntry } from './types'

beforeEach(async () => {
  await i18n.changeLanguage('en')
  // React logs every error a boundary catches, and these tests throw on purpose.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('the game error boundary (AC-54)', () => {
  const broken = { now: true }
  const brokenGame: GameEntry = {
    slug: 'broken',
    nameKey: 'games.game_guesser.name',
    order: 1,
    isDefault: false,
    screen: lazy(async () => ({
      default: function BrokenScreen({ date }: { date: string | null }) {
        if (broken.now) throw new Error('the game crashed')
        return <p>Playing {date}</p>
      },
    })),
  }

  beforeEach(() => {
    broken.now = true
  })

  it('shows an error inside the page, leaves the rest working, and "Try again" shows the screen', async () => {
    const user = userEvent.setup()
    render(
      <>
        <header>The header</header>
        <GameScreen game={brokenGame} date="2026-10-28" />
      </>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This game ran into a problem.')
    expect(screen.getByText('The header')).toBeTruthy()
    expect(screen.queryByText('Playing 2026-10-28')).toBeNull()

    broken.now = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('Playing 2026-10-28')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the focus in the game area after "Try again", and does not take it on first load', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Outside</button>
        <div data-testid="area">
          <GameScreen game={brokenGame} date="2026-10-28" />
        </div>
      </>,
    )
    const area = screen.getByTestId('area')
    await screen.findByRole('alert')
    expect(document.body.contains(document.activeElement)).toBe(true)
    expect(area.contains(document.activeElement)).toBe(false)

    broken.now = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Playing 2026-10-28')

    expect(document.activeElement).not.toBe(document.body)
    expect(area.contains(document.activeElement)).toBe(true)
  })

  it('starts clean for another day, and shows the error text in the current language', async () => {
    const { rerender } = render(
      <GameScreen game={brokenGame} date="2026-10-28" />,
    )
    await screen.findByRole('alert')

    await act(() => i18n.changeLanguage('ru'))
    expect(screen.getByRole('alert').textContent).toContain(
      'В игре произошла ошибка.',
    )
    expect(screen.getByRole('button').textContent).toBe('Попробовать снова')

    broken.now = false
    rerender(<GameScreen game={brokenGame} date="2026-10-27" />)

    expect(await screen.findByText('Playing 2026-10-27')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('a screen whose code fails to download (AC-53, AC-54)', () => {
  it('"Try again" downloads the code again and shows the screen', async () => {
    const user = userEvent.setup()
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch the module'))
      .mockResolvedValue({
        default: function LoadedScreen({ date }: { date: string | null }) {
          return <p>Playing {date}</p>
        },
      })
    const game: GameEntry = {
      slug: 'flaky',
      nameKey: 'games.game_guesser.name',
      order: 1,
      isDefault: false,
      screen: lazyWithRetry(load),
    }
    render(<GameScreen game={game} date="2026-10-28" />)

    await screen.findByRole('alert')
    expect(load).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Playing 2026-10-28')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('the page heading and the loading status (AC-53, AC-54)', () => {
  const headings = () => screen.getAllByRole('heading', { level: 1 })

  it('has one h1 while the code loads, after it loaded, and when the screen failed; the status region stays mounted', async () => {
    let finishLoading!: () => void
    const game: GameEntry = {
      slug: 'slow',
      nameKey: 'games.game_guesser.name',
      order: 1,
      isDefault: false,
      screen: lazyWithRetry(
        () =>
          new Promise((resolve) => {
            finishLoading = () =>
              resolve({
                default: function SlowScreen() {
                  return <h1>The real heading</h1>
                },
              })
          }),
      ),
    }
    render(<GameScreen game={game} date="2026-10-28" />)

    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Loading the game…')
    expect(headings().map((h) => h.textContent)).toEqual(['Game Guesser'])

    finishLoading()
    await screen.findByText('The real heading')

    expect(headings().map((h) => h.textContent)).toEqual(['The real heading'])
    expect(screen.getByRole('status')).toBe(status)
    expect(status.textContent).toBe('')
  })

  it('has one h1 when the screen failed', async () => {
    const game: GameEntry = {
      slug: 'crashing',
      nameKey: 'games.game_guesser.name',
      order: 1,
      isDefault: false,
      screen: lazyWithRetry(async () => ({
        default: function CrashingScreen(): never {
          throw new Error('the game crashed')
        },
      })),
    }
    render(<GameScreen game={game} date="2026-10-28" />)

    await screen.findByRole('alert')

    expect(headings().map((h) => h.textContent)).toEqual(['Game Guesser'])
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
