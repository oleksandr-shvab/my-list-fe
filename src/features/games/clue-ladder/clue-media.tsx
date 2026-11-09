import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaRead, PosterRead } from '@/api/generated/models'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClueVideo } from './clue-video'

type Link = { url: string; expiresAt: string }

// `retried` is links that were asked for, loading (a failure now is final, AC-25); `refreshing` and `removed` wait for
// new links, with the media on the page or, after "Try again", off it.
type Status =
  'loading' | 'loaded' | 'retried' | 'refreshing' | 'removed' | 'failed'

type Shown = {
  // What the page shows, and the last media from the view that was looked at.
  media: MediaRead
  seen: MediaRead
  status: Status
  // The still that fills a clip's box before it plays has a request of its own: its failure never touches the clip.
  poster: PosterRead | null
  posterStatus: 'ok' | 'refreshing' | 'retried'
  posterLoaded: string | null
}

// The link that stands for the media: its first source.
function linkOf(media: MediaRead): Link | null {
  const [source] = media.sources
  return source ? { url: source.url, expiresAt: media.expires_at } : null
}

// A link's file is its address without the query, where the signature and the expiry are (CONTRACTS, "Clue media").
function fileOf(url: string): string {
  const { origin, pathname } = new URL(url, window.location.href)
  return origin + pathname
}

function hasExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now()
}

function sourcesOf(media: MediaRead): string {
  return media.sources.map((source) => source.url).join(' ')
}

function takeMedia(now: Shown, media: MediaRead, status: Status): Shown {
  return {
    ...now,
    media,
    status,
    poster: media.poster,
    posterStatus: 'ok',
  }
}

// The view brought media, from a guess or as the answer to a request for links (already taken by `settle`). A good
// link stays, so the browser keeps its file and a clip keeps playing; a failed or expired one takes the new link.
function adopt(now: Shown, offered: MediaRead): Shown {
  const seen = { ...now, seen: offered }
  const link = linkOf(offered)
  const current = linkOf(now.media)
  if (!link || link.url === current?.url) return seen

  if (
    !current ||
    now.status === 'failed' ||
    now.status === 'refreshing' ||
    now.status === 'removed' ||
    hasExpired(current.expiresAt) ||
    fileOf(link.url) !== fileOf(current.url)
  ) {
    // Links that were asked for stay on trial; a guess's start fresh.
    const asked = now.status === 'refreshing' || now.status === 'removed'
    return takeMedia(seen, offered, asked ? 'retried' : 'loading')
  }
  // The poster runs out sooner than the clip does, and changing it does not restart the clip.
  const { poster } = offered
  if (
    poster &&
    now.poster &&
    poster.url !== now.poster.url &&
    hasExpired(now.poster.expires_at)
  ) {
    return { ...seen, poster, posterStatus: 'ok' }
  }
  return seen
}

// The answer to a request for links: take them, or, with nothing new, there is nothing to wait for.
function settle(now: Shown, fresh: MediaRead | undefined): Shown {
  if (now.status !== 'refreshing' && now.status !== 'removed') return now
  if (fresh && sourcesOf(fresh) !== sourcesOf(now.media)) {
    return takeMedia(now, fresh, 'retried')
  }
  // Media taken off the page tries the same links again; a file that just failed has nothing left to try.
  return { ...now, status: now.status === 'removed' ? 'retried' : 'failed' }
}

// The answer for the poster: only the new poster is taken, and a second failure ends the poster, not the clip.
function settlePoster(now: Shown, fresh: MediaRead | undefined): Shown {
  if (now.posterStatus !== 'refreshing') return now
  const poster = fresh?.poster
  return poster && poster.url !== now.poster?.url
    ? { ...now, poster, posterStatus: 'retried' }
    : { ...now, poster: null, posterStatus: 'retried' }
}

type ClueMediaProps = {
  media: MediaRead
  alt: string
  // Whether the step is the one shown: a clip on another step pauses.
  active: boolean
  // Gets every link signed again and gives this step's new media, if there is any.
  onRefreshLinks: () => Promise<MediaRead | undefined>
}

// The box takes its size from the media before the file loads, so the page does not jump (AC-19).
export function ClueMedia({
  media,
  alt,
  active,
  onRefreshLinks,
}: ClueMediaProps) {
  const { t } = useTranslation()
  const [shown, setShown] = useState<Shown>({
    media,
    seen: media,
    status: 'loading',
    poster: media.poster,
    posterStatus: 'ok',
    posterLoaded: null,
  })
  // The link a request is out for, so two failures of one file in a row ask once.
  const asking = useRef<string | null>(null)
  const askingPoster = useRef<string | null>(null)

  if (media !== shown.seen) setShown((now) => adopt(now, media))

  function ask(
    guard: { current: string | null },
    failedUrl: string,
    begin: (now: Shown) => Shown,
    answer: (now: Shown, fresh: MediaRead | undefined) => Shown,
  ) {
    if (guard.current === failedUrl) return
    guard.current = failedUrl
    setShown(begin)
    onRefreshLinks()
      .catch(() => undefined)
      .then((fresh) => {
        guard.current = null
        setShown((now) => answer(now, fresh))
      })
  }

  const clipUrl = linkOf(shown.media)?.url ?? ''

  // A file that failed, or a clip that stopped, asks for fresh links once (AC-24). A second failure shows the
  // message, and nothing asks again until the player presses "Try again" (AC-25).
  function handleFailure() {
    if (shown.status === 'retried') {
      setShown((now) =>
        now.status === 'retried' ? { ...now, status: 'failed' } : now,
      )
    } else if (shown.status === 'loading' || shown.status === 'loaded') {
      ask(asking, clipUrl, (now) => ({ ...now, status: 'refreshing' }), settle)
    }
  }

  function retry() {
    ask(asking, clipUrl, (now) => ({ ...now, status: 'removed' }), settle)
  }

  function handleLoaded() {
    setShown((now) => ({ ...now, status: 'loaded' }))
  }

  // A poster that fails asks for links once and takes only the new poster; a second failure drops the poster.
  function handlePosterFailure() {
    if (shown.posterStatus === 'retried') {
      setShown((now) => ({ ...now, poster: null }))
    } else if (shown.posterStatus === 'ok') {
      ask(
        askingPoster,
        shown.poster?.url ?? '',
        (now) => ({ ...now, posterStatus: 'refreshing' }),
        settlePoster,
      )
    }
  }

  const { poster } = shown
  const isVideo = shown.media.type === 'video'
  const posterShowing =
    isVideo && poster?.url === shown.posterLoaded && shown.status !== 'removed'
  const loading =
    shown.status !== 'loaded' && shown.status !== 'failed' && !posterShowing

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-lg bg-muted"
      style={{
        aspectRatio: `${media.width} / ${media.height}`,
        maxWidth: media.width,
      }}
    >
      {loading && <Skeleton className="absolute inset-0 rounded-none" />}
      {shown.status === 'failed' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('games.clue_failed')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-md:h-11"
            onClick={retry}
          >
            {t('games.clue_retry')}
          </Button>
        </div>
      ) : (
        shown.status !== 'removed' &&
        clipUrl !== '' &&
        (isVideo ? (
          <>
            <ClueVideo
              sources={shown.media.sources}
              poster={poster?.url}
              width={media.width}
              height={media.height}
              active={active}
              onLoaded={handleLoaded}
              onFailure={handleFailure}
            />
            {/* A `<video>` says nothing when its poster fails or loads, so the poster is also loaded as an image. */}
            {poster && (
              <img
                src={poster.url}
                alt=""
                hidden
                onLoad={() =>
                  setShown((now) => ({
                    ...now,
                    posterStatus: 'ok',
                    posterLoaded: poster.url,
                  }))
                }
                onError={handlePosterFailure}
              />
            )}
          </>
        ) : (
          <img
            src={clipUrl}
            alt={alt}
            width={media.width}
            height={media.height}
            onLoad={handleLoaded}
            onError={handleFailure}
            className="size-full object-cover"
          />
        ))
      )}
    </div>
  )
}
