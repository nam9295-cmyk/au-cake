import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const mobileQuery = '(max-width: 768px)'
const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
type HeroVariant = 'desktop' | 'mobile' | 'still'

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
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const mediaPath = `/redesign/hero/cake-${variant}`

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let inView = true
    const syncPlayback = () => {
      if (document.hidden || !inView || manuallyPaused) video.pause()
      else void video.play().catch(() => { /* Autoplay may be blocked; keep the Play button. */ })
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      syncPlayback()
    })
    observer.observe(video)
    document.addEventListener('visibilitychange', syncPlayback)
    syncPlayback()
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      video.pause()
    }
  }, [failed, manuallyPaused])

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    const pause = !video.paused
    onManualPause(pause)
    if (pause) video.pause()
    else void video.play().catch(() => { /* A denied play request leaves the poster and control available. */ })
  }

  return (
    <div className="rd-hero-photo-wrap">
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
            autoPlay={!manuallyPaused}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setFailed(true)}
          />
          <button
            type="button"
            className="rd-hero-video-toggle"
            aria-label={playing ? 'Pause hero video' : 'Play hero video'}
            onClick={togglePlayback}
          >
            {playing ? 'Pause video' : 'Play video'}
          </button>
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
