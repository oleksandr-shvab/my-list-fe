// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { onlineManager, focusManager } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameGuesserView, TitleRead } from '@/api/generated/models'
import i18n from '@/i18n'
import { gameView, GUEST, slowReply, startApp } from '@/test/router-harness'

const DAY = '2026-11-05'
const VIEW_URL = `/v1/games/game-guesser/puzzles/${DAY}`
const GUESS_URL = `${VIEW_URL}/guesses`
const TITLES_URL = '/v1/games/game-guesser/titles'

let stop: (() => void) | undefined

function renderApp() {
  const app = startApp({ path: `/games/game-guesser/${DAY}`, me: GUEST })
  stop = app.stop
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

function title(id: number, name: string): TitleRead {
  return { id, name, franchise: null, year: 1993 }
}

// A guest's game with no step after the first: only the box is under test.
function view(overrides: Partial<GameGuesserView> = {}): GameGuesserView {
  return gameView({ date: DAY, signed_in: false, steps: [], ...overrides })
}

function serve(
  app: ReturnType<typeof renderApp>,
  titles: (q: string) => TitleRead[],
  data: GameGuesserView = view(),
) {
  app.backend.replies.set(VIEW_URL, { status: 200, data })
  app.backend.replies.set(TITLES_URL, (config) => ({
    status: 200,
    data: { items: titles(String(config.params.q)) },
  }))
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  stop?.()
  stop = undefined
  onlineManager.setOnline(true)
  focusManager.setFocused(undefined)
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

const BOX = { name: 'Search for a game' }

// Real timers: the harness, the query cache and Testing Library's polling all run on them, and faking them makes
// every wait a manual pump. The only wait is the search's 250 ms pause, so this is 50 ms past it.
const pause = () => new Promise((resolve) => setTimeout(resolve, 300))
const flush = () => act(async () => {})

describe('the title search (AC-26, AC-27)', () => {
  it('sends nothing for one letter, and shows only the answer for the text in the box', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, (q) => [title(1, `Match for ${q}`)])
    const lateDo = slowReply()
    app.backend.replies.set(TITLES_URL, (config) =>
      config.params.q === 'do'
        ? lateDo.reply
        : { status: 200, data: { items: [title(2, 'Doom')] } },
    )

    const box = await screen.findByRole('combobox', BOX)
    await user.type(box, 'a')
    const message = screen.getByText('Type at least 2 letters')
    // A message is not a listbox: the box is not expanded, and the message is linked to it.
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box.getAttribute('aria-expanded')).toBe('false')
    expect(box.getAttribute('aria-describedby')).toBe(message.id)
    // "a." has one letter: the server would give nothing, so nothing is asked.
    await user.type(box, '.')
    expect(screen.getByText('Type at least 2 letters')).toBeTruthy()
    // Past the pause, so a request would have been sent by now.
    await pause()
    expect(app.backend.count(TITLES_URL)).toBe(0)

    await user.clear(box)
    await user.type(box, 'do')
    await waitFor(() => expect(app.backend.count(TITLES_URL)).toBe(1))
    expect(screen.getByText('Loading…')).toBeTruthy()

    await user.type(box, 'o')
    expect(await screen.findByRole('option', { name: /Doom/ })).toBeTruthy()
    expect(box.getAttribute('aria-expanded')).toBe('true')
    expect(box.getAttribute('aria-controls')).toBe(
      screen.getByRole('listbox').id,
    )
    await act(async () =>
      lateDo.answer({ status: 200, data: { items: [title(3, 'Do Only')] } }),
    )

    // The answer for "do" came last and belongs to older text.
    expect(screen.queryByRole('option', { name: /Do Only/ })).toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })
})

describe('the list (AC-31, AC-32, AC-33, AC-35)', () => {
  it('marks a title already tried, and Enter on it picks nothing', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(
      app,
      () => [title(2, 'Doom'), title(3, 'DOOM II')],
      view({
        guesses_used: 1,
        guesses_left: 5,
        guesses: [{ title_id: 2, name: 'Doom', result: 'wrong' }],
      }),
    )

    const box = await screen.findByRole('combobox', BOX)
    await user.type(box, 'do')
    const tried = await screen.findByRole('option', { name: /Already tried/ })
    expect(tried.getAttribute('aria-disabled')).toBe('true')

    await user.keyboard('{ArrowDown}{Enter}')
    await user.keyboard('{Enter}')

    expect((box as HTMLInputElement).value).toBe('do')
    expect(app.backend.count(GUESS_URL)).toBe(0)
  })

  it('goes to the last option on Up from nothing, and keeps it in view when the list opens again', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, () => [1, 2, 3, 4, 5].map((id) => title(id, `Doom ${id}`)))
    // jsdom has no layout: five options of 40 px in a list 80 px high that remembers its scroll.
    const scrolled = new WeakMap<Element, number>()
    vi.spyOn(Element.prototype, 'scrollTop', 'get').mockImplementation(
      function (this: Element) {
        return scrolled.get(this) ?? 0
      },
    )
    vi.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation(
      function (this: Element, value: number) {
        scrolled.set(this, value)
      },
    )
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
      function (this: HTMLElement) {
        return Array.from(this.parentElement?.children ?? []).indexOf(this) * 40
      },
    )
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(80)

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    await user.type(box, 'do')
    await screen.findAllByRole('option')
    await user.keyboard('{ArrowUp}')

    const last = screen.getByRole('option', { name: /Doom 5/ })
    expect(box.getAttribute('aria-activedescendant')).toBe(last.id)
    expect(screen.getByRole('listbox').scrollTop).toBe(120)

    // The same highlight, a new list element: it is scrolled to again.
    await user.keyboard('{Escape}')
    await user.click(box)
    expect(screen.getByRole('listbox').scrollTop).toBe(120)
  })

  it('leaves the keys of an IME composition to the IME', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, () => [title(2, 'Doom')])

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    await user.type(box, 'do')
    await screen.findByRole('option')
    await user.keyboard('{ArrowDown}')

    // The Enter that confirms a candidate is not a pick.
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true })
    expect(box.value).toBe('do')
    expect(box.getAttribute('aria-expanded')).toBe('true')

    await user.keyboard('{Enter}')
    expect(box.value).toBe('Doom')
  })

  it('moves with the arrow keys, picks with Enter, closes with Escape, and sends the picked id', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, () => [title(2, 'Doom'), title(3, 'DOOM II')])
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: view({
        guesses_used: 1,
        guesses_left: 5,
        guesses: [{ title_id: 3, name: 'DOOM II', result: 'wrong' }],
      }),
    })

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    await user.type(box, 'do')
    await screen.findAllByRole('option')
    expect(box.getAttribute('aria-expanded')).toBe('true')

    await user.keyboard('{Escape}')
    expect(box.getAttribute('aria-expanded')).toBe('false')

    await user.keyboard('{ArrowDown}{ArrowDown}')
    const second = screen.getByRole('option', { name: /DOOM II/ })
    expect(box.getAttribute('aria-activedescendant')).toBe(second.id)

    await user.keyboard('{Enter}')
    expect(box.value).toBe('DOOM II')
    expect(box.getAttribute('aria-expanded')).toBe('false')
    expect(app.backend.count(GUESS_URL)).toBe(0)

    await user.keyboard('{Enter}')

    expect(app.backend.bodiesOf(GUESS_URL)).toEqual([
      { title_id: 3, previous: [] },
    ])
    // Accepted and the game goes on: the box is empty.
    await waitFor(() => expect(box.value).toBe(''))

    // Sent with the button, the focus goes back to the box for the next guess.
    await user.type(box, 'do')
    await user.click(await screen.findByRole('option', { name: /^Doom/ }))
    await user.click(screen.getByRole('button', { name: 'Guess' }))
    await waitFor(() => expect(box.value).toBe(''))
    expect(document.activeElement).toBe(box)
  })
})

describe('a refused guess (AC-55, AC-57)', () => {
  it('keeps the pick after 429, and clears it after 422 duplicate_guess', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, () => [title(2, 'Doom')])
    let answers = 0
    app.backend.replies.set(GUESS_URL, () =>
      answers++ === 0
        ? {
            status: 429,
            data: { status: 429, code: 'too_many_requests', request_id: 'r' },
          }
        : {
            status: 422,
            data: { status: 422, code: 'duplicate_guess', request_id: 'r' },
          },
    )

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    await user.type(box, 'do')
    await user.click(await screen.findByRole('option', { name: /Doom/ }))
    await user.click(screen.getByRole('button', { name: 'Guess' }))

    expect(
      await screen.findByText(
        'Too many attempts. Please wait a moment and try again.',
      ),
    ).toBeTruthy()
    // No countdown: the same pick goes again at once.
    await user.click(screen.getByRole('button', { name: 'Guess' }))

    expect(
      await screen.findByText('You have already tried this one.'),
    ).toBeTruthy()
    expect(app.backend.bodiesOf(GUESS_URL)).toEqual([
      { title_id: 2, previous: [] },
      { title_id: 2, previous: [] },
    ])

    // The pick is gone: Guess does nothing until a title is picked again.
    await user.click(screen.getByRole('button', { name: 'Guess' }))
    expect(app.backend.count(GUESS_URL)).toBe(2)
    expect(box.value).toBe('Doom')

    // The name is still the pick's text, not the player's: nobody searches for it.
    await pause()
    expect(app.backend.count(TITLES_URL)).toBe(1)
  })
})

describe('a search that fails (AC-57, AC-58)', () => {
  it('shows the refusal text of 429 and 403 csrf, a plain failure for the rest, and never asks again by itself', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, () => [])
    const refusal = (status: number, code: string) => ({
      status,
      data: { status, code, request_id: 'r' },
    })
    app.backend.replies.set(TITLES_URL, (config) => {
      const q = String(config.params.q)
      if (q === 'aa') return refusal(429, 'too_many_requests')
      if (q === 'bb') return refusal(403, 'csrf_origin_mismatch')
      return refusal(500, 'internal_error')
    })

    const box = await screen.findByRole('combobox', BOX)
    await user.type(box, 'aa')
    expect(
      await screen.findByText(
        'Too many attempts. Please wait a moment and try again.',
      ),
    ).toBeTruthy()
    // A window focus and a reconnect do not send a refused search again by themselves (AC-57). A retry would show
    // the text only after its backoff, so it is caught by the wait above.
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })
    await flush()
    expect(app.backend.count(TITLES_URL)).toBe(1)

    await user.clear(box)
    await user.type(box, 'bb')
    expect(
      await screen.findByText(/an address the site does not accept/),
    ).toBeTruthy()

    await user.clear(box)
    await user.type(box, 'cc')
    expect(await screen.findByText('Search failed. Try again.')).toBeTruthy()
    expect(screen.queryByText(/Too many attempts/)).toBeNull()
  })
})

describe('the list shows the server answer for the text in the box (AC-27, AC-29)', () => {
  it('lists titles in the server order, counts them, never shows an older answer for newer text, and says when none match', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    // Not matching the text and not sorted: nothing may filter or reorder it.
    serve(app, (q) =>
      q === 'do'
        ? [title(7, 'Zelda'), title(5, 'Alpha'), title(6, 'Mario')]
        : [],
    )

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    await user.type(box, 'do')
    await screen.findAllByRole('option')
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Zelda1993', 'Alpha1993', 'Mario1993'])
    expect(await screen.findByText('3 results')).toBeTruthy()

    // "do" is still the cached answer while "doo" waits for the pause: it must not show for it.
    await user.type(box, 'o')
    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.queryByText('3 results')).toBeNull()

    expect(await screen.findByText('No games found')).toBeTruthy()

    // The input's own limit (AC-36).
    await user.clear(box)
    await user.type(box, 'x'.repeat(105))
    expect(box.value).toHaveLength(100)
  })
})

describe('the pick (AC-26, AC-55, AC-107)', () => {
  it('survives a language switch, sends no search for its text, and is lost when the text is edited', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, () => [title(2, 'Doom'), title(3, 'Sequel')])
    app.backend.replies.set(GUESS_URL, {
      status: 200,
      data: view({
        guesses_used: 1,
        guesses_left: 5,
        guesses: [{ title_id: 2, name: 'Doom', result: 'wrong' }],
      }),
    })

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    const guessButton = screen.getByRole('button', { name: 'Guess' })
    // Nothing picked yet.
    expect(guessButton.getAttribute('aria-disabled')).toBe('true')
    await user.click(guessButton)
    expect(app.backend.count(GUESS_URL)).toBe(0)

    // Typed without a pause: only the whole text is asked for, never "do".
    await user.type(box, 'dom')
    await user.click(await screen.findByRole('option', { name: /Doom/ }))
    expect(guessButton.getAttribute('aria-disabled')).toBe('false')
    // Past the pause: the text "Doom" is the pick's, so nobody asks for it.
    await pause()
    expect(app.backend.count(TITLES_URL)).toBe(1)

    await act(() => i18n.changeLanguage('ru'))
    expect(box.value).toBe('Doom')
    await user.click(screen.getByRole('button', { name: 'Ответить' }))
    await waitFor(() =>
      expect(app.backend.bodiesOf(GUESS_URL)).toEqual([
        { title_id: 2, previous: [] },
      ]),
    )
    await waitFor(() => expect(box.value).toBe(''))
    // The pick's name is the debounced text by now; clearing the box must not search for it.
    await flush()
    expect(app.backend.count(TITLES_URL)).toBe(1)

    // A pick and then an edit of its text: the text is not a title, so Guess has nothing to send.
    // Doom was tried by now, so the next pick is another title.
    await user.type(box, 'dom')
    await user.click(await screen.findByRole('option', { name: /Sequel/ }))
    expect(box.value).toBe('Sequel')
    await user.type(box, 'x')
    const ruButton = screen.getByRole('button', { name: 'Ответить' })
    expect(ruButton.getAttribute('aria-disabled')).toBe('true')
    await user.click(ruButton)
    expect(app.backend.count(GUESS_URL)).toBe(1)
  })
})

describe('a guess that is answered late (AC-35, AC-55)', () => {
  it('does not wipe what the player typed while it was on its way', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    serve(app, () => [title(2, 'Doom')])
    const late = slowReply()
    app.backend.replies.set(GUESS_URL, late.reply)

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    await user.type(box, 'do')
    await user.click(await screen.findByRole('option', { name: /Doom/ }))
    await user.click(screen.getByRole('button', { name: 'Guess' }))
    await user.type(box, 'x')
    await act(async () =>
      late.answer({
        status: 200,
        data: view({
          guesses_used: 1,
          guesses_left: 5,
          guesses: [{ title_id: 2, name: 'Doom', result: 'wrong' }],
        }),
      }),
    )

    // The answer was for "Doom"; the box now holds newer text of the player's.
    expect(
      await screen.findByText('Wrong. Step 1 unlocked. 5 guesses left.'),
    ).toBeTruthy()
    expect(box.value).toBe('Doomx')
  })
})

describe('a text already answered (AC-28, AC-29)', () => {
  it('shows its list at once with no "Loading…", and announces the count again', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    // The same number of items for every text.
    serve(app, () => [title(2, 'Doom'), title(3, 'DOOM II')])

    const box = (await screen.findByRole('combobox', BOX)) as HTMLInputElement
    await user.type(box, 'do')
    const region = await screen.findByText('2 results')
    await user.type(box, 'o')
    await screen.findByText('2 results')
    expect(app.backend.count(TITLES_URL)).toBe(2)

    // "do" has its answer already: no pause, no request, no "Loading…".
    await user.keyboard('{Backspace}')
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(app.backend.count(TITLES_URL)).toBe(2)
    // The count is the same as a moment ago, so it is emptied first or a screen reader would not speak it.
    expect(region.textContent).toBe('')
    await waitFor(() => expect(region.textContent).toBe('2 results'))
  })
})
