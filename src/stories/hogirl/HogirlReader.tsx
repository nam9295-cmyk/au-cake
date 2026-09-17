import { getHogirlMediaUrl, getHogirlResponsiveWidths } from './media.js'
import type { HogirlCaption, HogirlMediaAsset } from './types.js'

type HogirlReaderPanel = {
  id: string
  media: HogirlMediaAsset
  alt: string
  captions: HogirlCaption[]
}

type HogirlReaderEpisode = {
  number?: number
  eyebrow?: string
  title: string
  panels: HogirlReaderPanel[]
}

function srcSetFor(media: HogirlMediaAsset, mediaOrigin: string, format: 'avif' | 'webp') {
  return getHogirlResponsiveWidths(media.sourceWidth)
    .map((width: number) => `${getHogirlMediaUrl({ mediaOrigin, key: media.key, width, format })} ${width}w`)
    .join(', ')
}

function PanelCaptions({ captions, overlay = false }: { captions: HogirlCaption[]; overlay?: boolean }) {
  if (captions.length === 0) return null
  return (
    <div className={`hogirl-panel-captions${overlay ? ' hogirl-panel-captions--overlay' : ''}`}>
      {captions.map((caption, index) => <p className={caption.emphasis ? 'hogirl-panel-caption--emphasis' : undefined} key={`${caption.placement}-${index}`}>{caption.text}</p>)}
    </div>
  )
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
  return (
    <main className="hogirl-reader" lang={locale}>
      <header className="hogirl-reader-header">
        {(episode.eyebrow || episode.number !== undefined) && <p>{episode.eyebrow || `Episode ${episode.number}`}</p>}
        <h1>{episode.title}</h1>
      </header>
      <ol className="hogirl-panel-list">
        {episode.panels.map((panel, index) => {
          const widths = getHogirlResponsiveWidths(panel.media.sourceWidth)
          const largestWidth = widths.at(-1)
          const beforeCaptions = panel.captions.filter((caption) => caption.placement === 'before')
          const afterCaptions = panel.captions.filter((caption) => caption.placement === 'after')
          const overlayCaptions = panel.captions.filter((caption) => caption.placement === 'overlay')
          const firstVisiblePanel = index === 0

          return (
            <li key={panel.id} className="hogirl-panel" data-hogirl-panel={panel.id}>
              <PanelCaptions captions={beforeCaptions} />
              <figure className={overlayCaptions.length > 0 ? 'hogirl-panel-figure--with-overlay' : undefined}>
                <picture>
                  {widths.length > 0 && <source type="image/avif" srcSet={srcSetFor(panel.media, mediaOrigin, 'avif')} sizes="(min-width: 768px) 680px, calc(100vw - 32px)" />}
                  {widths.length > 0 && <source type="image/webp" srcSet={srcSetFor(panel.media, mediaOrigin, 'webp')} sizes="(min-width: 768px) 680px, calc(100vw - 32px)" />}
                  <img
                    src={getHogirlMediaUrl({ mediaOrigin, key: panel.media.key, width: largestWidth, format: 'webp' })}
                    alt={panel.alt}
                    width={panel.media.sourceWidth}
                    height={panel.media.sourceHeight}
                    loading={firstVisiblePanel ? 'eager' : 'lazy'}
                    {...(firstVisiblePanel ? { fetchPriority: 'high' as const } : {})}
                    decoding="async"
                  />
                </picture>
                {overlayCaptions.length > 0 && <figcaption><PanelCaptions captions={overlayCaptions} overlay /></figcaption>}
                {afterCaptions.length > 0 && <figcaption><PanelCaptions captions={afterCaptions} /></figcaption>}
              </figure>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
