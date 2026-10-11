import { useEffect, useRef, useState } from 'react'
import { Star, X, ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-react'
import featured from '../content/customer-stories-featured.json'
import { storyDate, storySource, type CustomerStory } from '../lib/customer-stories'
import '../styles/au-customer-stories.css'

export function StoryRating({ rating }: { rating: number }) {
  return <span className="au-story-rating" aria-label={`${rating} out of 5 stars`}>
    <span aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={12} fill={i < rating ? 'currentColor' : 'none'} />)}</span><small>{rating.toFixed(1)} / 5.0</small>
  </span>
}
export function StoryCard({ story, onOpen, compact = false }: { story: CustomerStory; onOpen: () => void; compact?: boolean }) {
  const photo = story.photos[0]
  return <article className={`au-story-card${compact ? ' au-story-compact' : ''}`} data-story-id={story.id}>
    {photo && <button className="au-story-photo" type="button" onClick={onOpen} aria-label={`Open customer photo and review by ${story.nickname}`}>
      <img src={photo.thumbnail} width={photo.width} height={photo.height} loading="lazy" decoding="async" alt={`Customer photo for ${story.id} from ${storySource(story)}`} />
      {story.title && <span className="au-story-product">{story.title}</span>}<span className="au-story-source">{storySource(story)}</span>
    </button>}
    <div className="au-story-card-body"><StoryRating rating={story.rating} />
      <p className="au-story-excerpt">{story.english || 'A customer shared photos with this review.'}</p>
      <small className="au-story-translation">{story.translated ? 'English translation · excerpt' : story.originalLanguage === 'English' ? 'Original English review' : 'Photo review · no written text'}</small>
      {story.translated && <div className="au-story-original-preview" lang="ko"><small>KOREAN ORIGINAL</small><p>{story.original}</p></div>}
      <div className="au-story-meta"><span>{story.nickname}</span><time dateTime={story.date}>{storyDate(story.date)}</time></div>
      {!photo && <small>{storySource(story)}</small>}
      <button className="au-story-read" type="button" onClick={onOpen}>Read full review <ArrowUpRight size={13} aria-hidden="true" /></button>
    </div>
  </article>
}
export function StoryDialog({ story, onClose }: { story: CustomerStory | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => {
    const element = dialog.current
    if (!story || !element) return
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = old; opener?.focus() }
  }, [story])
  if (!story) return null
  const photo = story.photos[photoIndex] || story.photos[0]
  return <dialog ref={dialog} className="au-story-dialog" aria-labelledby="au-story-dialog-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <button type="button" className="au-story-close" aria-label="Close review" autoFocus onClick={onClose}><X size={22} /> Close</button>
    <div className="au-story-dialog-grid">{photo && <div className="au-story-dialog-gallery">
      <img src={photo.src} width={photo.width} height={photo.height} alt={`Full customer photo ${photoIndex + 1} of ${story.photos.length}, review ${story.id}`} />
      {story.photos.length > 1 && <nav aria-label="Customer photos"><button type="button" aria-label="Previous photo" disabled={photoIndex === 0} onClick={() => setPhotoIndex(i=>i-1)}><ArrowLeft /></button><span>{photoIndex+1} / {story.photos.length}</span><button type="button" aria-label="Next photo" disabled={photoIndex === story.photos.length-1} onClick={() => setPhotoIndex(i=>i+1)}><ArrowRight /></button></nav>}
    </div>}
    <div className="au-story-dialog-copy"><p className="au-stories-eyebrow">{storySource(story)}</p><h2 id="au-story-dialog-title">{story.title || 'A customer story from Korea'}</h2><StoryRating rating={story.rating} />
      <p className="au-story-full-text" lang="en">{story.english || 'This customer shared photos without a written review.'}</p>
      <small>{story.translated ? 'English translation' : story.originalLanguage === 'English' ? 'Original English review' : 'Photo review'}</small>
      {story.translated && <div className="au-story-original"><h3>Korean original</h3><p lang="ko">{story.original}</p></div>}
      <p>{story.nickname} · <time dateTime={story.date}>{storyDate(story.date)}</time></p><p className="au-stories-disclosure">Selected reviews from our Korean store, not reviews of Australian orders.</p>
    </div></div>
  </dialog>
}
export function HomeCustomerStories() {
  const [selected, setSelected] = useState<CustomerStory | null>(null)
  const [lastPair, setLastPair] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  return <section className="au-stories au-stories-home" aria-labelledby="home-stories-title">
    <header className="au-stories-heading"><div><p className="au-stories-eyebrow">REAL CUSTOMER STORIES FROM KOREA</p><h2 id="home-stories-title">GOOD WORDS, SHARED.</h2><p>Real experiences, shared by our customers in Korea.</p></div><a className="au-stories-top-link" href="/customer-stories/korea">VIEW ALL CUSTOMER STORIES <ArrowUpRight size={16} /></a></header>
    <div className="au-stories-home-grid" ref={row} onScroll={e => setLastPair(e.currentTarget.scrollLeft > 30)}>
      {featured.map(story => <StoryCard key={story.id} story={story} compact onOpen={() => setSelected(story)} />)}
    </div>
    <div className="au-stories-carousel-controls"><div aria-label="Cards in view">{[0,1,2].map(i=><span key={i} className={(lastPair ? i>0 : i<2) ? 'is-visible' : ''} />)}</div><button type="button" onClick={() => row.current?.scrollTo({ left: lastPair ? 0 : row.current.scrollWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{lastPair ? 'BACK TO FIRST STORIES' : 'SWIPE TO EXPLORE'} <ArrowRight size={13} /></button></div>
    <a className="au-stories-mobile-link" href="/customer-stories/korea">VIEW ALL CUSTOMER STORIES <ArrowUpRight size={16} /></a>
    <footer className="au-stories-disclosure">Selected customer reviews from Korea · English translations where applicable.<br />Selected reviews from our Korean store, not reviews of Australian orders.</footer>
    <StoryDialog key={selected?.id ?? 'closed'} story={selected} onClose={() => setSelected(null)} />
  </section>
}
