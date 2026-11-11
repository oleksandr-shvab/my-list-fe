import type { TFunction } from 'i18next'
import type { ArchiveItem, ArchiveState } from '@/api/generated/models'
import {
  readGuestRecords,
  DEFAULT_VARIANT,
  type GuestRecord,
} from '../guest-records'
import { GUEST_VIEWER, isAccountViewer, type Viewer } from '../view-queries'

// The archive gives no `max_guesses`; the game has six guess slots (AC-84).
export const SLOTS = 6

// What a row shows: the state and how many guesses it took. Both are all the boxes are built from (Q2).
export type RowState = { state: ArchiveState; guessesUsed: number }

// A guest's played days of the default variant (the archive asks for no other), by date.
export function guestRecordsByDate(slug: string): Map<string, GuestRecord> {
  return new Map(
    readGuestRecords(slug)
      .filter(({ key }) => key.variant === DEFAULT_VARIANT)
      .map(({ key, record }) => [key.date, record]),
  )
}

// An account's item carries its state; a guest's does not, so the browser's record answers (AC-82).
export function rowStateOf(
  item: ArchiveItem,
  records: ReadonlyMap<string, GuestRecord>,
): RowState {
  if (item.state !== null) {
    return { state: item.state, guessesUsed: item.guesses_used ?? 0 }
  }
  const record = records.get(item.date)
  return record
    ? { state: record.status, guessesUsed: record.guesses.length }
    : { state: 'not_played', guessesUsed: 0 }
}

export function stateText(
  { state, guessesUsed }: RowState,
  t: TFunction,
): string {
  switch (state) {
    case 'not_played':
      return t('games.archive.state.not_played')
    case 'in_progress':
      return t('games.archive.state.in_progress')
    case 'won':
      return t('games.archive.state.won', { count: guessesUsed })
    case 'lost':
      return t('games.archive.state.lost')
  }
}

// The answer has no `signed_in`: an account's items all have a state and a guest's none (CONTRACTS, "Archive").
function hasAccountItems(items: readonly ArchiveItem[]) {
  return items.some((item) => item.state !== null)
}

export function hasGuestItems(items: readonly ArchiveItem[]) {
  return items.some((item) => item.state === null)
}

// The server saw another session than the key's, so these items are not this viewer's.
export function disagreesWithViewer(
  viewer: Viewer,
  items: readonly ArchiveItem[],
): boolean {
  if (isAccountViewer(viewer)) return hasGuestItems(items)
  return viewer === GUEST_VIEWER && hasAccountItems(items)
}

// Disagreement, or a viewer the page is not sure of ('unconfirmed') given an account's items: ask who is signed in.
export function needsSessionCheck(
  viewer: Viewer,
  items: readonly ArchiveItem[],
): boolean {
  return (
    disagreesWithViewer(viewer, items) ||
    (!isAccountViewer(viewer) && hasAccountItems(items))
  )
}

export type BoxMark = 'empty' | 'filled' | 'correct' | 'failed'

// Used slots are filled; a win marks the last one, a loss marks every used one (AC-84). A tampered record with more
// guesses than slots still draws six boxes.
export function boxesOf({ state, guessesUsed }: RowState): BoxMark[] {
  const used = Math.min(Math.max(guessesUsed, 0), SLOTS)
  return Array.from({ length: SLOTS }, (_, index) => {
    if (index >= used) return 'empty'
    if (state === 'lost') return 'failed'
    if (state === 'won' && index === used - 1) return 'correct'
    return 'filled'
  })
}
