import { toast } from 'sonner'
import { z } from 'zod'
import { GuessResult, ProgressStatus } from '@/api/generated/models'
import i18n from '@/i18n'

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

// The first failure of the browser's storage tells the player once that the game lasts only for this tab (AC-44).
function storageFailed() {
  if (noticeShown) return
  noticeShown = true
  toast.info(i18n.t('games.storage_blocked'), { duration: 10_000 })
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

// The played days of a game, for the stats, the archive and the merge: records with at least one guess. A record that
// only keeps a `daily_proof` (a view seen, nothing guessed) is not listed; `readGuestRecord` still reads it.
export function readGuestRecords(
  slug: string,
): { key: GuestRecordKey; record: GuestRecord }[] {
  const prefix = `${KEY_PREFIX}${slug}.`
  const found: { key: GuestRecordKey; record: GuestRecord }[] = []
  for (const raw of allKeys()) {
    if (!raw.startsWith(prefix)) continue
    // `<variant>.<date>`: the date is the last ten characters, so a variant may hold dots.
    const rest = raw.slice(prefix.length)
    const date = rest.slice(-10)
    const variant = rest.slice(0, -11)
    if (variant === '' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const key = { slug, variant, date }
    const record = readGuestRecord(key)
    if (record && record.guesses.length > 0) found.push({ key, record })
  }
  return found
}

// True once a failure sent this tab to its memory: the records are not saved for another visit.
export function isStorageBlocked(): boolean {
  return noticeShown
}
