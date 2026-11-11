import { useEffect, useState } from 'react'
import type { GuestRecord } from '../guest-records'
import { guestRecordsByDate } from './archive-state'

type Records = ReadonlyMap<string, GuestRecord>

const NO_RECORDS: Records = new Map()

function read(slug: string, needed: boolean): Records {
  return needed ? guestRecordsByDate(slug) : NO_RECORDS
}

// The browser's records of a game, read when `needed` and again whenever the page is shown again: another tab may
// have played meanwhile, and nothing listens to the storage here.
export function useGuestRecords(slug: string, needed: boolean): Records {
  const [state, setState] = useState(() => ({
    slug,
    needed,
    records: read(slug, needed),
  }))

  // A new game or a first need reads again during the render, so no frame shows the old records.
  let current = state
  if (state.slug !== slug || state.needed !== needed) {
    current = { slug, needed, records: read(slug, needed) }
    setState(current)
  }

  useEffect(() => {
    const reread = () => setState({ slug, needed, records: read(slug, needed) })
    window.addEventListener('focus', reread)
    document.addEventListener('visibilitychange', reread)
    return () => {
      window.removeEventListener('focus', reread)
      document.removeEventListener('visibilitychange', reread)
    }
  }, [slug, needed])

  return current.records
}
