import {
  useInfiniteQuery,
  useIsFetching,
  type InfiniteData,
} from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineError } from '@/components/inline-error'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { meQueryOptions } from '@/features/auth/queries'
import type { ArchiveList as ArchivePages } from '@/api/generated/models'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { UnknownGame } from '../unknown-game'
import { useViewer } from '../use-viewer'
import { ArchiveRow } from './archive-row'
import {
  disagreesWithViewer,
  hasGuestItems,
  needsSessionCheck,
  rowStateOf,
} from './archive-state'
import { archiveQueryOptions } from './queries'
import { useGuestRecords } from './use-guest-records'

const PLACEHOLDER_ROWS = 5

// What a fetch of the list answers with.
type Answer = {
  data: InfiniteData<ArchivePages> | undefined
  isError: boolean
  error: Error | null
}

// The backend does not know the game any more (it was switched off): nothing here can heal it.
function isGameGone(error: Error | null): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === 'game_not_found'
  )
}

// The past puzzles of a game, newest first, 30 at a time (AC-80). The server never lists today and no item has an
// answer (AC-86).
export function ArchiveList({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const { viewer, ready } = useViewer()
  const archive = useInfiniteQuery({
    ...archiveQueryOptions(slug, viewer),
    enabled: ready,
  })
  // `/auth/me` is being asked, by `queryFn` when the answer was for another session.
  const checkingSession = useIsFetching(meQueryOptions()) > 0
  const listRef = useRef<HTMLUListElement>(null)
  // A press that replaces its own button (Show more, Try again) owes the focus: to the row at this index when rows
  // arrive (AC-89), else to the new "Try again" that takes it when it appears.
  const owedFocus = useRef<number | null>(null)

  const items = useMemo(
    () => archive.data?.pages.flatMap((page) => page.items) ?? [],
    [archive.data],
  )
  const count = items.length
  const records = useGuestRecords(slug, hasGuestItems(items))

  useEffect(() => {
    const index = owedFocus.current
    if (index === null || count <= index) return
    owedFocus.current = null
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>('a')
    links?.[index]?.focus()
  }, [count])

  function takeOwedFocus(button: HTMLButtonElement | null) {
    if (!button || owedFocus.current === null) return
    owedFocus.current = null
    button.focus()
  }

  // Runs a press that owes the focus. An answer with no new rows and no "Try again" to come owes nothing, so a later
  // change of the list cannot take the focus.
  function press(load: () => Promise<Answer>) {
    const from = count
    owedFocus.current = from
    void load().then((result) => {
      const pages = result.data?.pages ?? []
      const rows = pages.reduce((sum, page) => sum + page.items.length, 0)
      const retryComes = result.isError && !isGameGone(result.error)
      if (rows <= from && !retryComes) owedFocus.current = null
    })
  }

  const showMore = () => {
    if (!archive.isFetchingNextPage) press(() => archive.fetchNextPage())
  }
  const retry = () => press(() => archive.refetch())

  if (archive.data === undefined && isGameGone(archive.error)) {
    return <UnknownGame />
  }

  // Items of another session than the key's are never shown. Under 'unconfirmed' an account's items wait for the answer
  // of `/auth/me`.
  const mismatch = disagreesWithViewer(viewer, items)
  const unsure = !mismatch && needsSessionCheck(viewer, items)
  const hidden = mismatch || (unsure && checkingSession)
  const settling = checkingSession || archive.isFetching

  return (
    <div className="flex max-w-2xl flex-1 flex-col items-start gap-4">
      <h1 className="text-2xl font-medium">{t('games.archive_title')}</h1>
      <Link
        to="/games/$slug"
        params={{ slug }}
        className={cn(buttonVariants({ variant: 'outline' }), 'max-md:h-11')}
      >
        {t('games.archive.back_to_today')}
      </Link>

      {archive.data === undefined && archive.isError && (
        <ArchiveError
          error={archive.error}
          onRetry={retry}
          buttonRef={takeOwedFocus}
        />
      )}
      {/* A retry of the first page is a pending query again, so it shows the placeholders too. */}
      {((archive.data === undefined && !archive.isError) ||
        (hidden && settling)) && <Placeholders />}
      {mismatch && !settling && (
        <ArchiveError error={null} onRetry={retry} buttonRef={takeOwedFocus} />
      )}
      {!hidden && archive.data !== undefined && count === 0 && (
        <p className="text-muted-foreground">{t('games.archive.empty')}</p>
      )}
      {!hidden && count > 0 && (
        <ul
          ref={listRef}
          aria-label={t('games.archive.list_label')}
          className="flex w-full flex-col gap-2"
        >
          {items.map((item) => (
            <li key={item.date}>
              <ArchiveRow
                slug={slug}
                item={item}
                rowState={rowStateOf(item, records)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Rows that are shown stay when the next page fails. */}
      {archive.isFetchNextPageError && (
        <ArchiveError
          error={archive.error}
          onRetry={showMore}
          busy={archive.isFetchingNextPage}
          buttonRef={takeOwedFocus}
        />
      )}
      {!hidden && archive.hasNextPage && !archive.isFetchNextPageError && (
        <Button
          type="button"
          variant="outline"
          className="max-md:h-11"
          aria-disabled={archive.isFetchingNextPage}
          onClick={showMore}
        >
          {archive.isFetchingNextPage
            ? t('games.archive.loading_more')
            : t('games.archive.show_more')}
        </Button>
      )}
    </div>
  )
}

function Placeholders() {
  const { t } = useTranslation()
  return (
    <>
      <p role="status" className="sr-only">
        {t('games.archive.loading')}
      </p>
      <div aria-hidden className="flex w-full flex-col gap-2">
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    </>
  )
}

// "Try again" cannot help when the game is gone.
function ArchiveError({
  error,
  onRetry,
  busy,
  buttonRef,
}: {
  error: Error | null
  onRetry: () => void
  busy?: boolean
  buttonRef: (button: HTMLButtonElement | null) => void
}) {
  return (
    <InlineError
      error={error}
      fallbackKey="games.archive.load_failed"
      retryKey="games.archive.retry"
      busyKey="games.archive.loading_more"
      onRetry={isGameGone(error) ? undefined : onRetry}
      busy={busy}
      buttonRef={buttonRef}
    />
  )
}
