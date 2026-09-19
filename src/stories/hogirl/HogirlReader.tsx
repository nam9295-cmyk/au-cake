import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { getHogirlMediaUrl, getHogirlResponsiveWidths } from './media.js'
import { resolveHogirlPageTurn } from './page-turn.js'
import type { HogirlCaption, HogirlCaptionLayout, HogirlMediaAsset } from './types.js'

const TURN_DURATION_MS = 480
const RETURN_DURATION_MS = 260

type TurnDirection = -1 | 0 | 1
type TurnPhase = 'idle' | 'dragging' | 'settling'

type HogirlReaderPanel = {
  id: string
  media: HogirlMediaAsset
  alt: string
  captions: HogirlCaption[]
  captionLayout?: HogirlCaptionLayout
}

type HogirlReaderEpisode = {
  number?: number
  eyebrow?: string
  title: string
  panels: HogirlReaderPanel[]
}
type PageTurnState = {
  key: string
  index: number
  progress: number
  phase: TurnPhase
  direction: TurnDirection
}

type GestureState = {
  pointerId: number
  startX: number
  startTime: number
  widthPx: number
}

function srcSetFor(media: HogirlMediaAsset, mediaOrigin: string, format: 'avif' | 'webp') {
  return getHogirlResponsiveWidths(media.sourceWidth)
    .map((width: number) => `${getHogirlMediaUrl({ mediaOrigin, key: media.key, width, format })} ${width}w`)
    .join(', ')
}

function isMobilePageTurn() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function PanelCaptions({ captions, overlay = false }: { captions: HogirlCaption[]; overlay?: boolean }) {
  if (captions.length === 0) return null
  return (
    <div className={`hogirl-panel-captions${overlay ? ' hogirl-panel-captions--overlay' : ''}`}>
      {captions.map((caption, index) => (
        <p
          className={caption.emphasis ? 'hogirl-panel-caption--emphasis' : undefined}
          key={`${caption.placement}-${index}`}
        >
          {caption.text}
        </p>
      ))}
    </div>
  )
}

function captionLayoutStyle(layout: HogirlCaptionLayout): CSSProperties {
  return {
    '--hogirl-caption-x': `${layout.x}%`,
    '--hogirl-caption-y': `${layout.y}%`,
    '--hogirl-caption-width': `${layout.maxWidth}%`,
    textAlign: layout.align,
  } as CSSProperties
}

function captionLayerClass(layout?: HogirlCaptionLayout) {
  if (!layout) return 'hogirl-panel-caption-layer hogirl-panel-caption-layer--bottom'
  return [
    'hogirl-panel-caption-layer',
    'hogirl-panel-caption-layer--positioned',
    layout.tone === 'forest' ? 'hogirl-panel-caption-layer--forest' : '',
  ].filter(Boolean).join(' ')
}

export function HogirlReader({
  episode,
  locale,
  mediaOrigin,
}: {
  episode: HogirlReaderEpisode
  locale: string
  mediaOrigin: string
}) {
  const panelListRef = useRef<HTMLOListElement>(null)
  const gestureRef = useRef<GestureState | null>(null)
  const turnTimerRef = useRef<number | null>(null)
  const episodeKey = `${episode.eyebrow || ''}:${episode.number || ''}:${episode.title}`
  const [pageTurn, setPageTurn] = useState<PageTurnState>({
    key: episodeKey,
    index: 1,
    progress: 0,
    phase: 'idle',
    direction: 0,
  })
  const activeTurn = pageTurn.key === episodeKey
    ? pageTurn
    : { key: episodeKey, index: 1, progress: 0, phase: 'idle' as const, direction: 0 as const }
  const currentPanel = activeTurn.index

  useEffect(() => () => {
    if (turnTimerRef.current !== null) window.clearTimeout(turnTimerRef.current)
  }, [])

  function clearTurnTimer() {
    if (turnTimerRef.current === null) return
    window.clearTimeout(turnTimerRef.current)
    turnTimerRef.current = null
  }

  function settlePage(target: number, direction: TurnDirection) {
    clearTurnTimer()
    const changed = target !== currentPanel
    const progress = changed ? (direction === 1 ? -1.04 : 1.04) : 0
    const duration = prefersReducedMotion() ? 0 : (changed ? TURN_DURATION_MS : RETURN_DURATION_MS)
    setPageTurn({ key: episodeKey, index: currentPanel, progress, phase: 'settling', direction })
    turnTimerRef.current = window.setTimeout(() => {
      setPageTurn({ key: episodeKey, index: target, progress: 0, phase: 'idle', direction: 0 })
      turnTimerRef.current = null
    }, duration)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLOListElement>) {
    if (!isMobilePageTurn() || episode.panels.length < 2 || activeTurn.phase === 'settling') return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const widthPx = event.currentTarget.clientWidth
    if (widthPx <= 0) return

    clearTurnTimer()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startTime: performance.now(),
      widthPx,
    }
    setPageTurn({ key: episodeKey, index: currentPanel, progress: 0, phase: 'dragging', direction: 0 })
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLOListElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const rawDistance = event.clientX - gesture.startX
    const direction: TurnDirection = rawDistance < 0 ? 1 : rawDistance > 0 ? -1 : 0
    const blocked = (direction === 1 && currentPanel >= episode.panels.length)
      || (direction === -1 && currentPanel <= 1)
    const resistedDistance = blocked ? rawDistance * 0.18 : rawDistance
    const progress = Math.max(-0.48, Math.min(0.48, resistedDistance / gesture.widthPx))
    setPageTurn({ key: episodeKey, index: currentPanel, progress, phase: 'dragging', direction })
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLOListElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const distancePx = event.clientX - gesture.startX
    const elapsedMs = performance.now() - gesture.startTime
    const target = resolveHogirlPageTurn({
      current: currentPanel,
      total: episode.panels.length,
      distancePx,
      widthPx: gesture.widthPx,
      elapsedMs,
    })
    const direction: TurnDirection = target > currentPanel ? 1 : target < currentPanel ? -1 : activeTurn.direction
    settlePage(target, direction)
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLOListElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    settlePage(currentPanel, activeTurn.direction)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLOListElement>) {
    if (!isMobilePageTurn() || activeTurn.phase === 'settling') return
    const direction: TurnDirection = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    const target = Math.min(episode.panels.length, Math.max(1, currentPanel + direction))
    if (target !== currentPanel) settlePage(target, direction)
  }

  const listClassName = [
    'hogirl-panel-list',
    activeTurn.phase !== 'idle' ? `hogirl-panel-list--${activeTurn.phase}` : '',
    activeTurn.direction === 1 ? 'hogirl-panel-list--next' : '',
    activeTurn.direction === -1 ? 'hogirl-panel-list--previous' : '',
  ].filter(Boolean).join(' ')

  const listStyle = {
    '--hogirl-turn-x': `${activeTurn.progress * 100}%`,
    '--hogirl-turn-rotate': `${activeTurn.progress * 14}deg`,
    '--hogirl-turn-reveal': String(Math.min(1, Math.abs(activeTurn.progress))),
  } as CSSProperties

  return (
    <main className="hogirl-reader" lang={locale}>
      <header className="hogirl-reader-header">
        {(episode.eyebrow || episode.number !== undefined) && <p>{episode.eyebrow || `Episode ${episode.number}`}</p>}
        <h1>{episode.title}</h1>
      </header>
      <ol
        key={episodeKey}
        className={listClassName}
        ref={panelListRef}
        style={listStyle}
        data-active-panel={currentPanel}
        tabIndex={0}
        aria-label="Story pages"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        onDragStart={(event) => event.preventDefault()}
      >
        {episode.panels.map((panel, index) => {
          const widths = getHogirlResponsiveWidths(panel.media.sourceWidth)
          const largestWidth = widths.at(-1)
          const bottomCaptions = panel.captions.filter((caption) => caption.placement !== 'overlay')
          const overlayCaptions = panel.captions.filter((caption) => caption.placement === 'overlay')
          const hasPerCaptionLayout = bottomCaptions.some((caption) => caption.layout)
          const firstVisiblePanel = index === 0
          const panelNumber = index + 1
          const active = panelNumber === currentPanel
          const candidate = activeTurn.direction === 1
            ? panelNumber === currentPanel + 1
            : activeTurn.direction === -1
              ? panelNumber === currentPanel - 1
              : false
          const panelClassName = [
            'hogirl-panel',
            active ? 'hogirl-panel--active' : '',
            candidate ? 'hogirl-panel--candidate' : '',
          ].filter(Boolean).join(' ')
          return (
            <li key={panel.id} className={panelClassName} data-hogirl-panel={panel.id}>
              <figure className={panel.captions.length > 0 ? 'hogirl-panel-figure--captioned' : undefined}>
                <picture>
                  {widths.length > 0 && (
                    <source
                      type="image/avif"
                      srcSet={srcSetFor(panel.media, mediaOrigin, 'avif')}
                      sizes="(min-width: 768px) 680px, calc(100vw - 32px)"
                    />
                  )}
                  {widths.length > 0 && (
                    <source
                      type="image/webp"
                      srcSet={srcSetFor(panel.media, mediaOrigin, 'webp')}
                      sizes="(min-width: 768px) 680px, calc(100vw - 32px)"
                    />
                  )}
                  <img
                    src={getHogirlMediaUrl({ mediaOrigin, key: panel.media.key, width: largestWidth, format: 'webp' })}
                    alt={panel.alt}
                    width={panel.media.sourceWidth}
                    height={panel.media.sourceHeight}
                    loading={firstVisiblePanel ? 'eager' : 'lazy'}
                    {...(firstVisiblePanel ? { fetchPriority: 'high' as const } : {})}
                    decoding="async"
                    draggable={false}
                  />
                </picture>
                {bottomCaptions.length > 0 && !hasPerCaptionLayout && (
                  <figcaption
                    className={captionLayerClass(panel.captionLayout)}
                    style={panel.captionLayout ? captionLayoutStyle(panel.captionLayout) : undefined}
                  >
                    <PanelCaptions captions={bottomCaptions} />
                  </figcaption>
                )}
                {hasPerCaptionLayout && bottomCaptions.map((caption, captionIndex) => {
                  const layout = caption.layout || panel.captionLayout
                  return (
                    <figcaption
                      className={captionLayerClass(layout)}
                      style={layout ? captionLayoutStyle(layout) : undefined}
                      key={`${panel.id}-caption-${captionIndex}`}
                    >
                      <PanelCaptions captions={[caption]} />
                    </figcaption>
                  )
                })}
                {overlayCaptions.length > 0 && (
                  <figcaption className="hogirl-panel-caption-layer hogirl-panel-caption-layer--center">
                    <PanelCaptions captions={overlayCaptions} overlay />
                  </figcaption>
                )}
              </figure>
            </li>
          )
        })}
      </ol>
      {episode.panels.length > 1 && (
        <div className="hogirl-swipe-progress" aria-live="polite" aria-atomic="true">
          {currentPanel} / {episode.panels.length}
        </div>
      )}
    </main>
  )
}
