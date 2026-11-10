import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { gamesSearchTitles } from '@/api/generated/api'

const MIN_LETTERS = 2
const DEBOUNCE_MS = 250
// The backend sends `public, max-age=300` for a search.
const FRESH_MS = 5 * 60 * 1000

// The server gives no items for fewer than 2 letters or digits ("a.", "a-"), so none is asked for (CONTRACTS, "Title search").
export function hasSearchableText(text: string): boolean {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= MIN_LETTERS
}

function titlesKey(slug: string, q: string) {
  return ['titles', slug, q] as const
}

// The key holds the text, so an older answer can never show for newer text (AC-27). A failure is never sent again by
// itself, not by a retry, a window focus or a reconnect: only a change of the text asks again (AC-57, AC-58).
export function titlesQueryOptions(slug: string, q: string, enabled: boolean) {
  return queryOptions({
    queryKey: titlesKey(slug, q),
    queryFn: ({ signal }) => gamesSearchTitles(slug, { q }, { signal }),
    enabled: enabled && hasSearchableText(q),
    staleTime: FRESH_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value])
  return debounced
}

// Asked after the player pauses, or at once for a text already answered (no "Loading…"). Nothing is asked until
// `settled` (the text is the one searched), so a pick's name sends no search.
export function useTitleSearch(slug: string, text: string, enabled: boolean) {
  const queryClient = useQueryClient()
  const trimmed = text.trim()
  const debounced = useDebounced(trimmed)
  const answered =
    queryClient.getQueryData(titlesKey(slug, trimmed)) !== undefined
  const searched = answered ? trimmed : debounced
  const settled = searched === trimmed
  const query = useQuery(titlesQueryOptions(slug, searched, enabled && settled))
  return { trimmed, settled, searchable: hasSearchableText(trimmed), query }
}
