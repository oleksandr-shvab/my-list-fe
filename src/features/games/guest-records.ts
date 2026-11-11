import { toast } from 'sonner'
import { z } from 'zod'
import { GuessResult, ProgressStatus } from '@/api/generated/models'
import i18n from '@/i18n'
import { parsePuzzleDate } from '@/lib/utc-date'

// One `localStorage` key per game, variant and day (AC-37): the guesses with results, the status, `counts_for_streak`
// and `daily_proof`. Never the answer, a media link or anything that depends on the language.
const KEY_PREFIX = 'dgc.guest.v1.'

// The game guesser has one variant and the app never asks for another (CONTRACTS, "Games").
export const DEFAULT_VARIANT = 'default'

// The server takes at most 20 entries in `previous`; a longer list could never be sent.
const MAX_GUESSES = 20

// Stored data is untrusted: anyone can edit it, so every read is checked (AC-45).
const guestRecordSchema = z.object({
  guesses: z
    .array(
      z.object({
        title_id: z.number().int().nullable(),
        name: z.string().nullable(),
        result: z.enum(GuessResult),
      }),
    )
    .max(MAX_GUESSES),
  status: z.enum(ProgressStatus),
  counts_for_streak: z.boolean().nullable(),
  daily_proof: z.string().nullable(),
})

export type GuestRecord = z.infer<typeof guestRecordSchema>

export type GuestRecordKey = { slug: string; variant: string; date: string }

function storageKey({ slug, variant, date }: GuestRecordKey): string {
  return `${KEY_PREFIX}${slug}.${variant}.${date}`
}

// Records the browser would not store: a value, or null for one deleted here. It wins over the storage, so this tab
// still reads them back.
const memory = new Map<string, string | null>()
let noticeShown = false

// The first failure of the browser's storage tells the player once that the game lasts only for this tab (AC-44). The
// toast waits a tick: a read can fail while a component renders, and a toast must not update the Toaster then.
function storageFailed() {
  if (noticeShown) return
  noticeShown = true
  setTimeout(() => {
    toast.info(i18n.t('games.storage_blocked'), { duration: 10_000 })
  }, 0)
}

// Reading `window.localStorage` itself can throw (blocked cookies), so every use goes through here.
function attempt<T>(work: (storage: Storage) => T): T | undefined {
  try {
    return work(window.localStorage)
  } catch {
    storageFailed()
    return undefined
  }
}

function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null
  return attempt((storage) => storage.getItem(key)) ?? null
}

function writeRaw(key: string, value: string) {
  const stored = attempt((storage) => {
    storage.setItem(key, value)
    return true
  })
  if (stored) memory.delete(key)
  else memory.set(key, value)
}

function removeRaw(key: string) {
  const removed = attempt((storage) => {
    storage.removeItem(key)
    return true
  })
  if (removed) memory.delete(key)
  else memory.set(key, null)
}

function allKeys(): string[] {
  const keys = new Set<string>()
  attempt((storage) => {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null) keys.add(key)
    }
  })
  for (const [key, value] of memory) {
    if (value === null) keys.delete(key)
    else keys.add(key)
  }
  return [...keys]
}

// A missing record, text that is not JSON and a value of the wrong shape all read as no record (AC-45).
function parseRecord(raw: string | null): GuestRecord | undefined {
  if (raw === null) return undefined
  try {
    const parsed = guestRecordSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export function readGuestRecord(key: GuestRecordKey): GuestRecord | undefined {
  return parseRecord(readRaw(storageKey(key)))
}

export function writeGuestRecord(key: GuestRecordKey, record: GuestRecord) {
  writeRaw(storageKey(key), JSON.stringify(record))
}

export function deleteGuestRecord(key: GuestRecordKey) {
  removeRaw(storageKey(key))
}

type PlayedRecord = { key: GuestRecordKey; record: GuestRecord }

// The played days of the wanted games, for the stats, the archive and the merge: records with at least one guess. A
// record that only keeps a `daily_proof` (a view seen, nothing guessed) is not listed; `readGuestRecord` still reads it.
function collectGuestRecords(
  wanted: (slug: string) => boolean,
): Map<string, PlayedRecord[]> {
  const found = new Map<string, PlayedRecord[]>()
  for (const raw of allKeys()) {
    if (!raw.startsWith(KEY_PREFIX)) continue
    // `<slug>.<variant>.<date>`: a slug has no dots; the date is the last ten characters, so a variant may hold dots.
    const rest = raw.slice(KEY_PREFIX.length)
    const dot = rest.indexOf('.')
    const slug = rest.slice(0, dot)
    if (dot < 0 || !wanted(slug)) continue
    const date = rest.slice(-10)
    const variant = rest.slice(dot + 1, -11)
    // A key anyone can write: a date that is not a real day (2026-13-40) is no record.
    if (variant === '' || parsePuzzleDate(date) === null) continue
    const key = { slug, variant, date }
    // A stray key (`defaultX2026-11-05`) would read as the real one and list its record twice.
    if (storageKey(key) !== raw) continue
    const record = readGuestRecord(key)
    if (record && record.guesses.length > 0) {
      const played = found.get(slug) ?? []
      played.push({ key, record })
      found.set(slug, played)
    }
  }
  return found
}

export function readGuestRecords(slug: string): PlayedRecord[] {
  return collectGuestRecords((found) => found === slug).get(slug) ?? []
}

// The same for several games with one scan of the storage.
export function readGuestRecordsByGame(
  slugs: readonly string[],
): Map<string, PlayedRecord[]> {
  return collectGuestRecords((slug) => slugs.includes(slug))
}

// The sign-up nudge's "Not now" (AC-93): one flag for this browser. With storage that refuses it is kept for this tab
// only, like a record (AC-94).
const NUDGE_DISMISSED_KEY = 'dgc.nudge_dismissed'

export function isNudgeDismissed(): boolean {
  return readRaw(NUDGE_DISMISSED_KEY) !== null
}

export function dismissNudge() {
  writeRaw(NUDGE_DISMISSED_KEY, '1')
}

// True once a failure sent this tab to its memory: the records are not saved for another visit.
export function isStorageBlocked(): boolean {
  return noticeShown
}
