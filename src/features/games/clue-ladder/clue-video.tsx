import { Pause, Play } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaSourceRead } from '@/api/generated/models'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

// A refused or interrupted start is not an error the player needs to see (AC-23).
function start(video: HTMLVideoElement) {
  void Promise.resolve(video.play()).catch(() => {})
}

type ClueVideoProps = {
  // In the order given: the browser takes the first one it can play (AC-21).
  sources: MediaSourceRead[]
  poster: string | undefined
  width: number
  height: number
  // Whether the clip's step is the one shown: a clip on another step pauses.
  active: boolean
  // The first frame is ready: the loading state can end.
  onLoaded: () => void
  // Every source failed to load, or the file stopped working while it played.
  onFailure: () => void
}

// The step-6 clip: muted, looping, inline, with a play and pause control that is always there (AC-21, AC-22).
export function ClueVideo({
  sources,
  poster,
  width,
  height,
  active,
  onLoaded,
  onFailure,
}: ClueVideoProps) {
  const { t } = useTranslation()
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const hasPlayed = useRef(false)
  // Paused because its step was hidden, so it plays again when the step is shown.
  const resumeOnShow = useRef(false)
  const failedHidden = useRef(false)

  const reportHiddenFailure = useEffectEvent(() => {
    if (!failedHidden.current) return
    failedHidden.current = false
    onFailure()
  })

  // A clip on a step the player is not looking at does not play or download. It plays when shown if it was playing,
  // or if it never started and nothing stops it (reduced motion asked for, or a refused start, AC-23).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!active) {
      if (!video.paused) {
        video.pause()
        resumeOnShow.current = true
      }
      return
    }
    reportHiddenFailure()
    if (resumeOnShow.current || (!hasPlayed.current && !reducedMotion)) {
      resumeOnShow.current = false
      start(video)
    }
  }, [active, reducedMotion])

  // New links do not make the element read its sources again, so load them. It plays after that on the same terms.
  const sourceKey = sources.map((source) => source.url).join('\n')
  const shownKey = useRef(sourceKey)
  useEffect(() => {
    const video = videoRef.current
    if (!video || shownKey.current === sourceKey) return
    shownKey.current = sourceKey
    const resume =
      active && (!video.paused || (!hasPlayed.current && !reducedMotion))
    video.load()
    if (resume) start(video)
  }, [sourceKey, active, reducedMotion])

  function toggle() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) start(video)
    else video.pause()
  }

  // A `<source>` that fails is followed by the next, so only the last one failing means none could be played. Its
  // error reaches the `<video>`'s handler too (React bubbles it), which takes only the video's own errors.
  const lastIndex = sources.length - 1
  // A failure on a hidden step waits until the player opens it.
  function fail() {
    if (active) onFailure()
    else failedHidden.current = true
  }

  return (
    <>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        width={width}
        height={height}
        onLoadedData={onLoaded}
        onPlay={() => {
          hasPlayed.current = true
          setPlaying(true)
        }}
        onPause={() => setPlaying(false)}
        onError={(event) => {
          if (event.target === event.currentTarget) fail()
        }}
        className="relative size-full object-cover"
      >
        {sources.map((source, index) => (
          <source
            key={source.url}
            src={source.url}
            type={source.content_type}
            onError={index === lastIndex ? fail : undefined}
          />
        ))}
      </video>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={t(playing ? 'games.clip_pause' : 'games.clip_play')}
        onClick={toggle}
        className="absolute right-2 bottom-2 max-md:size-11"
      >
        {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
      </Button>
    </>
  )
}
