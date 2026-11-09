import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaRead } from '@/api/generated/models'
import { Skeleton } from '@/components/ui/skeleton'

type Link = { url: string; expiresAt: string }

// A video step shows its poster as a still; the clip itself comes with M1-30b.
function stillOf(media: MediaRead): Link | null {
  if (media.type === 'video') {
    return media.poster
      ? { url: media.poster.url, expiresAt: media.poster.expires_at }
      : null
  }
  const [source] = media.sources
  return source ? { url: source.url, expiresAt: media.expires_at } : null
}

// A link's file is its address without the query, where the signature and the expiry are (CONTRACTS, "Clue media").
function fileOf(url: string): string {
  const { origin, pathname } = new URL(url, window.location.href)
  return origin + pathname
}

function hasExpired(link: Link): boolean {
  return Date.parse(link.expiresAt) <= Date.now()
}

// The box takes its size from the media before the file loads, so the page does not jump (AC-19).
export function ClueMedia({ media, alt }: { media: MediaRead; alt: string }) {
  const { t } = useTranslation()
  const offered = stillOf(media)
  const [shown, setShown] = useState({
    link: offered,
    loaded: false,
    failed: false,
  })

  // Every guess signs all links again. The shown file stays while its link is still good, so the browser does not
  // download it again; a failed or expired one takes the new link.
  if (
    offered &&
    offered.url !== shown.link?.url &&
    (!shown.link ||
      shown.failed ||
      hasExpired(shown.link) ||
      fileOf(offered.url) !== fileOf(shown.link.url))
  ) {
    setShown({ link: offered, loaded: false, failed: false })
  }

  // M1-30b: this is where a failed or expired link asks the screen for fresh links, once (AC-24, AC-25).
  // Until then a failed file ends the loading state and says so.
  function handleError() {
    setShown((current) => ({ ...current, failed: true }))
  }

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-lg bg-muted"
      style={{
        aspectRatio: `${media.width} / ${media.height}`,
        maxWidth: media.width,
      }}
    >
      {!shown.loaded && !shown.failed && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {shown.failed ? (
        <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted-foreground">
          {t('games.clue_failed')}
        </p>
      ) : (
        shown.link && (
          <img
            src={shown.link.url}
            alt={alt}
            width={media.width}
            height={media.height}
            onLoad={() => setShown((current) => ({ ...current, loaded: true }))}
            onError={handleError}
            className="size-full object-cover"
          />
        )
      )}
    </div>
  )
}
