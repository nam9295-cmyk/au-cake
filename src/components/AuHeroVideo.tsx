import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const mobileQuery = '(max-width: 768px)'
const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
type HeroVariant = 'desktop' | 'mobile' | 'still'
type PlaybackState = 'loading' | 'playing' | 'blocked' | 'failed'

function subscribeToPreferences(onChange: () => void) {
  const queries = [window.matchMedia(mobileQuery), window.matchMedia(reducedMotionQuery)]
  queries.forEach(query => query.addEventListener('change', onChange))
  return () => queries.forEach(query => query.removeEventListener('change', onChange))
}

function getVariant(): HeroVariant {
  if (window.matchMedia(reducedMotionQuery).matches) return 'still'
  return window.matchMedia(mobileQuery).matches ? 'mobile' : 'desktop'
}

function getServerVariant(): HeroVariant {
  return 'still'
}

function HeroMedia({ variant, manuallyPaused, onManualPause }: {
  variant: HeroVariant
  manuallyPaused: boolean
  onManualPause: (paused: boolean) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const manuallyPausedRef = useRef(manuallyPaused)
  const requestPlaybackRef = useRef<() => void>(() => {})
  const [playbackState, setPlaybackState] = useState<PlaybackState>('loading')
  const failed = playbackState === 'failed'
  const mediaPath = `/redesign/hero/cake-${variant}`

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.defaultMuted = true
    video.muted = true
    let inView = true
    let disposed = false
    let pending = false
    let attempt = 0
    let canPlayRetried = false
    let abortRetryUsed = false

    const requestPlayback = () => {
      if (disposed || document.hidden || !inView || manuallyPausedRef.current || pending || !video.paused) return
      video.defaultMuted = true
      video.muted = true
      const currentAttempt = ++attempt
      pending = true
      void video.play().then(() => {
        if (disposed || currentAttempt !== attempt) return
        pending = false
      }).catch((error: unknown) => {
        if (disposed || currentAttempt !== attempt) return
        pending = false
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (!abortRetryUsed && !document.hidden && inView && !manuallyPausedRef.current) {
            abortRetryUsed = true
            queueMicrotask(requestPlayback)
          }
          return
        }
        setPlaybackState(video.error || (error instanceof DOMException && error.name === 'NotSupportedError')
          ? 'failed'
          : 'blocked')
      })
    }
    requestPlaybackRef.current = requestPlayback

    const syncPlayback = () => {
      if (document.hidden || !inView || manuallyPausedRef.current) {
        attempt += 1
        pending = false
        abortRetryUsed = false
        video.pause()
      } else requestPlayback()
    }
    const observer = new IntersectionObserver(([entry]) => {
      const wasInView = inView
      inView = entry.isIntersecting
      if (!inView || !wasInView) syncPlayback()
    })
    const onCanPlay = () => {
      if (canPlayRetried) return
      canPlayRetried = true
      requestPlayback()
    }
    const onPlaying = () => {
      if (document.hidden || !inView || manuallyPausedRef.current) {
        video.pause()
        return
      }
      abortRetryUsed = false
      setPlaybackState('playing')
    }
    const onError = () => setPlaybackState('failed')
    observer.observe(video)
    document.addEventListener('visibilitychange', syncPlayback)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('error', onError)
    syncPlayback()
    return () => {
      disposed = true
      attempt += 1
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('error', onError)
      requestPlaybackRef.current = () => {}
      video.pause()
    }
  }, [failed])

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    const pause = !video.paused
    manuallyPausedRef.current = pause
    onManualPause(pause)
    if (pause) video.pause()
    else requestPlaybackRef.current()
  }

  const showControl = manuallyPaused || playbackState === 'playing' || playbackState === 'blocked'
  const playLabel = manuallyPaused || playbackState === 'blocked'

  return (
    <div className="rd-hero-photo-wrap" data-playback={playbackState}>
      <picture className="rd-hero-poster">
        <source media={mobileQuery} srcSet="/redesign/hero/cake-mobile.webp" />
        <img
          className="rd-hero-photo"
          src="/redesign/hero/cake-desktop.webp"
          alt="Chocolate cake with a cut slice"
          fetchPriority="high"
        />
      </picture>
      {variant !== 'still' && !failed && (
        <>
          <video
            ref={videoRef}
            className="rd-hero-photo"
            src={`${mediaPath}.mp4`}
            poster={`${mediaPath}.webp`}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          />
          {showControl && (
            <button
              type="button"
              className="rd-hero-video-toggle"
              aria-label={playLabel ? 'Play hero video' : 'Pause hero video'}
              onClick={togglePlayback}
            >
              {playLabel ? 'Play video' : 'Pause video'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function AuHeroVideo() {
  const variant = useSyncExternalStore(subscribeToPreferences, getVariant, getServerVariant)
  const [manuallyPaused, setManuallyPaused] = useState(false)
  return <HeroMedia key={variant} variant={variant} manuallyPaused={manuallyPaused} onManualPause={setManuallyPaused} />
}
