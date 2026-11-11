// @vitest-environment jsdom
import '@/test/dom-setup'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchiveItem, GuessRead } from '@/api/generated/models'
import i18n from '@/i18n'
import {
  GUEST,
  SERVER_ERROR,
  SIGNED_IN,
  slowReply,
  startApp,
  type Reply,
} from '@/test/router-harness'
import { writeGuestRecord } from '../guest-records'
import { guestRecordsByDate } from './archive-state'
import { useGuestRecords } from './use-guest-records'

// The page's whole path to the browser's records, wrapped to see how it is used (both still work for real). The merge
// reads the storage directly, so its reads cannot be taken for the page's.
vi.mock('./archive-state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./archive-state')>()
  return { ...actual, guestRecordsByDate: vi.fn(actual.guestRecordsByDate) }
})
vi.mock('./use-guest-records', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./use-guest-records')>()
  return { ...actual, useGuestRecords: vi.fn(actual.useGuestRecords) }
})

const SLUG = 'game-guesser'
const ARCHIVE_URL = `/v1/games/${SLUG}/archive`

let stop: (() => void) | undefined

function renderArchive(reply: Reply, me: Reply = GUEST) {
  const app = startApp({ path: `/games/${SLUG}/archive`, me })
  stop = app.stop
  app.backend.replies.set(ARCHIVE_URL, reply)
  render(
    <QueryClientProvider client={app.queryClient}>
      <RouterProvider router={app.router} />
    </QueryClientProvider>,
  )
  return app
}

// A guest's item: the server fills in neither the state nor the count.
function guestItem(date: string, number: number): ArchiveItem {
  return { date, number, state: null, guesses_used: null }
}

function guess(id: number, result: GuessRead['result']): GuessRead {
  return { title_id: id, name: `Game ${id}`, result }
}

function record(
  date: string,
  status: 'won' | 'in_progress',
  guesses: GuessRead[],
  variant = 'default',
) {
  writeGuestRecord(
    { slug: SLUG, variant, date },
    { guesses, status, counts_for_streak: false, daily_proof: null },
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  await i18n.changeLanguage('en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.restoreAllMocks()
})

describe('the archive list for a guest (AC-81, AC-82, AC-85)', () => {
  it('takes each row state from the browser records and names the boxes with the state text', async () => {
    record('2026-11-03', 'won', [
      guess(1, 'wrong'),
      guess(2, 'wrong'),
      guess(3, 'correct'),
    ])
    record('2026-11-02', 'in_progress', [guess(4, 'wrong')])
    // The archive asks for the default variant only: a won game of another variant is not this day's.
    record('2026-11-01', 'won', [guess(5, 'correct')], 'other')
    renderArchive({
      status: 200,
      data: {
        items: [
          guestItem('2026-11-03', 310),
          guestItem('2026-11-02', 309),
          guestItem('2026-11-01', 308),
        ],
        next_before: null,
      },
    })

    const rows = within(
      await screen.findByRole('list', { name: 'Past puzzles' }),
    )
      .getAllByRole('listitem')
      .map((item) => within(item))
    expect(rows).toHaveLength(3)

    const expected = [
      ['2026-11-03', '#310', 'November 3, 2026', 'Solved in 3'],
      ['2026-11-02', '#309', 'November 2, 2026', 'In progress'],
      ['2026-11-01', '#308', 'November 1, 2026', 'Not played'],
    ]
    rows.forEach((row, index) => {
      const [day, number, date, state] = expected[index]
      const link = row.getByRole('link')
      expect(link.getAttribute('href')).toBe(`/games/${SLUG}/${day}`)
      expect(link.textContent).toContain(number)
      expect(link.textContent).toContain(date)
      // The visible state and the boxes' name say the same words.
      expect(row.getByText(state).textContent).toBe(state)
      expect(row.getByRole('img').getAttribute('aria-label')).toBe(state)
    })
  })
})

describe('coming back to the tab', () => {
  it('reads the browser records again without asking for the pages again', async () => {
    const app = renderArchive({
      status: 200,
      data: { items: [guestItem('2026-11-03', 310)], next_before: null },
    })
    expect(await screen.findByText('Not played')).toBeTruthy()

    // Another tab won this day. The archive's answer is the same, only the storage differs.
    record('2026-11-03', 'won', [guess(1, 'correct')])
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    })

    expect(await screen.findByText('Solved in 1')).toBeTruthy()
    expect(
      app.backend.requests.filter((url) => url === ARCHIVE_URL),
    ).toHaveLength(1)
  })
})

describe('"Show more" (AC-80, AC-89)', () => {
  it('asks for the days before next_before, adds the rows, focuses the first new one and goes away at the end', async () => {
    const user = userEvent.setup()
    const app = renderArchive((config) =>
      config.params?.before === '2026-11-02'
        ? {
            status: 200,
            data: { items: [guestItem('2026-11-01', 308)], next_before: null },
          }
        : {
            status: 200,
            data: {
              items: [
                guestItem('2026-11-03', 310),
                guestItem('2026-11-02', 309),
              ],
              next_before: '2026-11-02',
            },
          },
    )

    await user.click(await screen.findByRole('button', { name: 'Show more' }))

    const newRow = await screen.findByRole('link', { name: /^#308/ })
    expect(screen.getAllByRole('link', { name: /^#3\d\d/ })).toHaveLength(3)
    expect(document.activeElement).toBe(newRow)
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
    expect(
      app.backend.configs
        .filter((config) => config.url?.endsWith('/archive'))
        .map((config) => config.params),
    ).toEqual([{ limit: 30 }, { limit: 30, before: '2026-11-02' }])
  })
})

// The row's six boxes are `role="img"` with the state text as name; the icons in them mark the win and the losses.
function boxesOf(row: ReturnType<typeof within>) {
  const boxes = row.getByRole('img')
  return {
    name: boxes.getAttribute('aria-label'),
    count: boxes.children.length,
    icons: boxes.querySelectorAll('svg').length,
  }
}

describe('the archive list for an account (AC-81, AC-84, AC-85)', () => {
  it('shows the server state and guess count, not the browser record, and draws the boxes from them', async () => {
    // Records of this browser for days the server speaks for: the server's item wins.
    vi.mocked(guestRecordsByDate).mockClear()
    vi.mocked(useGuestRecords).mockClear()
    record('2026-11-04', 'won', [guess(1, 'correct')])
    record('2026-11-02', 'won', [guess(2, 'correct')])
    const app = renderArchive(
      {
        status: 200,
        data: {
          items: [
            { date: '2026-11-05', number: 311, state: 'won', guesses_used: 3 },
            { date: '2026-11-04', number: 310, state: 'lost', guesses_used: 6 },
            {
              date: '2026-11-03',
              number: 309,
              state: 'in_progress',
              guesses_used: 2,
            },
            {
              date: '2026-11-02',
              number: 308,
              state: 'not_played',
              guesses_used: 0,
            },
          ],
          next_before: null,
        },
      },
      SIGNED_IN,
    )
    // The browser's games move into the account first (AC-100); the merge is what reads the records.
    app.backend.replies.set(`/v1/games/${SLUG}/progress/merge`, {
      status: 200,
      data: {
        stored: 2,
        already_present: 0,
        rejected: 0,
        daily_unproven: 0,
        rejected_entries: [],
      },
    })

    const rows = within(
      await screen.findByRole('list', { name: 'Past puzzles' }),
    )
      .getAllByRole('listitem')
      .map((item) => within(item))
    expect(rows.map(boxesOf)).toEqual([
      // A win marks one box, the last used; a loss marks every used one; the rest of the boxes carry no icon.
      { name: 'Solved in 3', count: 6, icons: 1 },
      { name: 'Not solved', count: 6, icons: 6 },
      { name: 'In progress', count: 6, icons: 0 },
      { name: 'Not played', count: 6, icons: 0 },
    ])
    // Every item has its state, so the page never asks for the browser's records: not on any render, also the one a focus
    // causes (it renders again, which the call count shows).
    record('2026-11-03', 'won', [guess(3, 'correct')])
    const renders = vi.mocked(useGuestRecords).mock.calls.length
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(vi.mocked(useGuestRecords).mock.calls.length).toBeGreaterThan(
      renders,
    )
    expect(
      vi.mocked(useGuestRecords).mock.calls.map(([, needed]) => needed),
    ).not.toContain(true)
    expect(guestRecordsByDate).not.toHaveBeenCalled()
    expect(rows.map((row) => row.getByRole('link').textContent)).toEqual([
      expect.stringContaining('Solved in 3'),
      expect.stringContaining('Not solved'),
      expect.stringContaining('In progress'),
      expect.stringContaining('Not played'),
    ])
  })
})

describe('when the archive does not load (AC-87)', () => {
  // A 4xx that no catalogue text covers and the query does not retry by itself.
  const failure = {
    status: 403,
    data: { status: 403, code: 'denied', request_id: 'req-403' },
  }

  it('shows the error in the layout with a working "Try again", and keeps the rows when the next page fails', async () => {
    const user = userEvent.setup()
    let firstPage: Reply = failure
    let nextPage: Reply = failure
    const app = renderArchive((config) =>
      config.params?.before === undefined ? firstPage : nextPage,
    )

    // Inside the layout: the sidebar is there and the error is in `main`.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe("Couldn't load the archive.")
    expect(within(screen.getByRole('main')).getByRole('alert')).toBe(alert)
    expect(screen.getByRole('navigation', { name: 'Games' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Past puzzles' })).toBeNull()

    // While the retry is on its way the error is gone and the placeholders show (AC-87).
    const late = slowReply()
    firstPage = late.reply
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'Loading the archive…',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    await act(async () =>
      late.answer({
        status: 200,
        data: {
          items: [guestItem('2026-11-03', 310), guestItem('2026-11-02', 309)],
          next_before: '2026-11-02',
        },
      }),
    )
    expect(await screen.findByRole('link', { name: /^#309/ })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()

    // The next page fails: the two rows stay, the error is under them, and "Show more" gives way to "Try again".
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't load the archive.",
    )
    expect(screen.getAllByRole('link', { name: /^#3\d\d/ })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()

    nextPage = {
      status: 200,
      data: { items: [guestItem('2026-11-01', 308)], next_before: null },
    }
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: /^#308/ })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /^#3\d\d/ })).toHaveLength(3)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      app.backend.configs
        .filter((config) => config.url?.endsWith('/archive'))
        .map((config) => config.params?.before),
    ).toEqual([undefined, undefined, '2026-11-02', '2026-11-02'])
  })
})

describe('a game the backend no longer has (AC-87, SPEC-03 edge case "Game disabled")', () => {
  it('shows "Unknown game" in the layout and no "Try again", which could never succeed', async () => {
    renderArchive({
      status: 404,
      data: { status: 404, code: 'game_not_found', request_id: 'req-404' },
    })

    const heading = await screen.findByRole('heading', {
      name: 'Unknown game',
    })
    expect(screen.getByRole('main').contains(heading)).toBe(true)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Games' })).toBeTruthy()
  })
})

describe('a failed "Show more" (AC-89)', () => {
  it('moves the focus to "Try again", and a later change of the list does not take it to a row', async () => {
    const user = userEvent.setup()
    let firstPage: ArchiveItem[] = [
      guestItem('2026-11-03', 310),
      guestItem('2026-11-02', 309),
    ]
    const app = renderArchive((config) =>
      config.params?.before === undefined
        ? { status: 200, data: { items: firstPage, next_before: '2026-11-02' } }
        : {
            status: 403,
            data: { status: 403, code: 'denied', request_id: 'r' },
          },
    )

    await user.click(await screen.findByRole('button', { name: 'Show more' }))

    // "Show more" is gone with the error: the focus is on its replacement, not lost to the page.
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(document.activeElement).toBe(retry)

    // A new day appears on a refetch. The rows grow, but the press that failed no longer says where the focus goes.
    firstPage = [guestItem('2026-11-04', 311), ...firstPage]
    await act(() =>
      app.queryClient.invalidateQueries({ queryKey: ['archive'] }),
    )
    expect(await screen.findByRole('link', { name: /^#311/ })).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Past puzzles' })
    expect(list.contains(document.activeElement)).toBe(false)
  })
})

describe('a "Show more" that adds no rows (AC-89)', () => {
  it('leaves the focus alone when the list changes later', async () => {
    const user = userEvent.setup()
    let firstPage = [guestItem('2026-11-03', 310), guestItem('2026-11-02', 309)]
    const app = renderArchive((config) => ({
      status: 200,
      data:
        config.params?.before === undefined
          ? { items: firstPage, next_before: '2026-11-02' }
          : { items: [], next_before: null },
    }))

    await user.click(await screen.findByRole('button', { name: 'Show more' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull(),
    )

    // A new day appears: the list grows, but no press is waiting for its rows.
    firstPage = [guestItem('2026-11-04', 311), ...firstPage]
    await act(() =>
      app.queryClient.invalidateQueries({ queryKey: ['archive'] }),
    )
    expect(await screen.findByRole('link', { name: /^#311/ })).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Past puzzles' })
    expect(list.contains(document.activeElement)).toBe(false)
  })
})

describe('"Try again" on a first page that fails (AC-87)', () => {
  it('puts the focus on the new "Try again" when it fails again, and on the first row when it works', async () => {
    const user = userEvent.setup()
    let reply: Reply = {
      status: 403,
      data: { status: 403, code: 'denied', request_id: 'r' },
    }
    renderArchive(() => reply)

    // The retry takes a while, so its own button is gone meanwhile; it fails again.
    const first = await screen.findByRole('button', { name: 'Try again' })
    const late = slowReply()
    reply = late.reply
    await user.click(first)
    expect((await screen.findByRole('status')).textContent).toBe(
      'Loading the archive…',
    )
    await act(async () =>
      late.answer({
        status: 403,
        data: { status: 403, code: 'denied', request_id: 'r' },
      }),
    )
    const again = await screen.findByRole('button', { name: 'Try again' })
    expect(document.activeElement).toBe(again)

    reply = {
      status: 200,
      data: { items: [guestItem('2026-11-03', 310)], next_before: null },
    }
    await user.click(again)
    const row = await screen.findByRole('link', { name: /^#310/ })
    expect(document.activeElement).toBe(row)
  })
})

describe('an answer for another session than the page holds', () => {
  const guestAnswer: Reply = {
    status: 200,
    data: { items: [guestItem('2026-11-03', 310)], next_before: null },
  }

  it('asks who is signed in, and shows the browser records once the session has ended', async () => {
    record('2026-11-03', 'won', [
      guess(1, 'wrong'),
      guess(2, 'wrong'),
      guess(3, 'correct'),
    ])
    // The page thinks an account is signed in; the server saw a guest (the session expired). Asked again, it says so.
    let asked = 0
    const app = renderArchive(guestAnswer, () =>
      ++asked === 1 ? SIGNED_IN : GUEST,
    )

    expect(await screen.findByText('Solved in 3')).toBeTruthy()
    expect(app.backend.count('/v1/auth/me')).toBe(2)
  })

  it('never shows the browser records under an account key, even when the check does not change the session', async () => {
    const user = userEvent.setup()
    record('2026-11-03', 'won', [
      guess(1, 'wrong'),
      guess(2, 'wrong'),
      guess(3, 'correct'),
    ])
    const app = renderArchive(guestAnswer, SIGNED_IN)

    // The check says "signed in" again, so the guest answer cannot be this account's: an error, not the records.
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't load the archive.",
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByText('Solved in 3')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Past puzzles' })).toBeNull()

    // Asking again is not an error: the placeholders show until the new answer is in.
    const late = slowReply()
    app.backend.replies.set(ARCHIVE_URL, late.reply)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'Loading the archive…',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => late.answer(guestAnswer))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it.each([
    ['guest', GUEST],
    ['unconfirmed', SERVER_ERROR],
  ])(
    "hides an account's states under a %s key until `/auth/me` has answered, then shows them",
    async (_viewer, firstAnswer) => {
      // The page holds no account, but the server answers for one (a sign-in in another tab). Asked again, it says so.
      const late = slowReply()
      let answered = false
      let asked = false
      renderArchive(
        () => {
          answered = true
          return {
            status: 200,
            data: {
              items: [
                {
                  date: '2026-11-03',
                  number: 310,
                  state: 'won',
                  guesses_used: 3,
                },
              ],
              next_before: null,
            },
          }
        },
        // Only the question that follows the archive's answer is the slow one.
        () => {
          if (!answered) return firstAnswer
          asked = true
          return late.reply
        },
      )

      // The archive has answered and `/auth/me` is being asked: the states wait for it.
      await waitFor(() => expect(asked).toBe(true))
      expect(screen.getByRole('status').textContent).toBe(
        'Loading the archive…',
      )
      expect(screen.queryByText('Solved in 3')).toBeNull()
      expect(screen.queryByRole('list', { name: 'Past puzzles' })).toBeNull()

      await act(async () => late.answer(SIGNED_IN))
      expect(await screen.findByText('Solved in 3')).toBeTruthy()
    },
  )
})

describe('account states under the guest key', () => {
  it('shows an error, not the states, when the check says guest again', async () => {
    renderArchive({
      status: 200,
      data: {
        items: [
          { date: '2026-11-03', number: 310, state: 'won', guesses_used: 3 },
        ],
        next_before: null,
      },
    })

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't load the archive.",
    )
    expect(screen.queryByText('Solved in 3')).toBeNull()
  })
})

describe('an archive with no past puzzles (AC-80)', () => {
  it('says so, lists nothing and offers no "Show more"', async () => {
    renderArchive({ status: 200, data: { items: [], next_before: null } })

    expect(await screen.findByText('No past puzzles yet')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Past puzzles' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
    expect(
      screen.getByRole('link', { name: "Back to today's puzzle" }),
    ).toBeTruthy()
  })
})

describe('the date of a row (AC-83)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is the UTC day in the current language, whatever the device timezone', async () => {
    // At midnight UTC it is still the evening before in Los Angeles.
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(new Date('2026-11-03T00:00:00Z').getDate()).toBe(2)
    renderArchive({
      status: 200,
      data: { items: [guestItem('2026-11-03', 310)], next_before: null },
    })

    const link = await screen.findByRole('link', { name: /^#310/ })
    expect(link.getAttribute('aria-label')).toBe(
      '#310, November 3, 2026, Not played',
    )

    await act(() => i18n.changeLanguage('ru'))
    expect(
      screen.getByRole('link', { name: /^#310/ }).getAttribute('aria-label'),
    ).toBe('#310, 3 ноября 2026 г., Не сыграно')
  })
})
