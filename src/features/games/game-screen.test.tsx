// @vitest-environment jsdom
import '@/test/dom-setup'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lazy } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { GameScreen } from './game-screen'
import { getDefaultGame } from './registry'
import type { GameEntry } from './types'

beforeEach(async () => {
  await i18n.changeLanguage('en')
  // React logs an error a boundary catches; the tests make some on purpose.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('the placeholder screen (AC-47, AC-55a)', () => {
  it('shows the name, the UTC day and "coming soon", and keeps its page when the language changes', async () => {
    render(<GameScreen game={getDefaultGame()} date="2026-10-28" isToday />)

    // The screen's code loads first (AC-53).
    expect(screen.getByRole('status').textContent).toBe('Loading the game…')
    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Game Guesser')
    expect(screen.getByText('Puzzle for October 28, 2026')).toBeTruthy()
    expect(screen.getByText('This game is coming soon.')).toBeTruthy()

    await act(() => i18n.changeLanguage('ru'))

    // The same element, with new text: the screen was not remounted.
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading)
    expect(heading.textContent).toBe('Game Guesser')
    expect(screen.getByText('Загадка на 28 октября 2026 г.')).toBeTruthy()
    expect(screen.getByText('Эта игра скоро появится.')).toBeTruthy()
  })
})

describe('the game error boundary (AC-54)', () => {
  // A screen that throws while `broken.now` is true.
  const broken = { now: true }
  const brokenGame: GameEntry = {
    slug: 'broken',
    nameKey: 'games.game_guesser.name',
    order: 1,
    isDefault: false,
    screen: lazy(async () => ({
      default: function BrokenScreen({ date }: { date: string }) {
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
        <GameScreen game={brokenGame} date="2026-10-28" isToday />
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

  it('starts clean for another day, and shows the error text in the current language', async () => {
    const { rerender } = render(
      <GameScreen game={brokenGame} date="2026-10-28" isToday />,
    )
    await screen.findByRole('alert')

    await act(() => i18n.changeLanguage('ru'))
    expect(screen.getByRole('alert').textContent).toContain(
      'В игре произошла ошибка.',
    )
    expect(screen.getByRole('button').textContent).toBe('Попробовать снова')

    // Another puzzle gets a new boundary, without a click on the button.
    broken.now = false
    rerender(<GameScreen game={brokenGame} date="2026-10-27" isToday={false} />)

    expect(await screen.findByText('Playing 2026-10-27')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
