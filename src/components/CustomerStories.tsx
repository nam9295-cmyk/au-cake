import { useEffect, useRef, useState } from 'react'
import { Star, X, ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-react'
import featured from '../content/customer-stories-featured.json'
import { useAuLanguage } from '../lib/au-language'
import {
  storyDate,
  storySource,
  type CustomerStory,
} from '../lib/customer-stories'

export function StoryRating({ rating }: { rating: number }) {
  const { t } = useAuLanguage()
  return (
    <span className="au-story-rating" aria-label={t(`${rating} out of 5 stars`, `5점 만점에 ${rating}점`)}>
      <span aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={12} fill={i < rating ? 'currentColor' : 'none'} />
        ))}
      </span>
      <small>{rating.toFixed(1)} / 5.0</small>
    </span>
  )
}
export function StoryCard({
  story,
  onOpen,
  compact = false,
}: {
  story: CustomerStory
  onOpen: () => void
  compact?: boolean
}) {
  const { language, t } = useAuLanguage()
  const photo = story.photos[0]
  const koreanOriginal = language === 'ko' && story.originalLanguage !== 'English'
  const mobileExcerpt = compact && !koreanOriginal && story.mobileExcerpt
  return (
    <article
      className={`au-story-card${compact ? ' au-story-compact' : ''}`}
      data-story-id={story.id}
    >
      {photo && (
        <button
          className="au-story-photo"
          type="button"
          onClick={onOpen}
          aria-label={t(`Open customer photo and review by ${story.nickname}`, `${story.nickname}님의 사진과 후기 보기`)}
        >
          <img
            src={photo.thumbnail}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            alt={`Customer photo for ${story.id} from ${storySource(story)}`}
          />
          {story.title && (
            <span className="au-story-product">{story.title}</span>
          )}
          <span className="au-story-source">{storySource(story)}</span>
        </button>
      )}
      <div className="au-story-card-body">
        <StoryRating rating={story.rating} />
        <p
          className={`au-story-excerpt${mobileExcerpt ? ' au-story-desktop-excerpt' : ''}`}
          lang={koreanOriginal ? 'ko' : 'en'}
        >
          {(koreanOriginal ? story.original : story.english) || t('A customer shared photos with this review.', '고객님이 사진을 남겨주신 후기입니다.')}
        </p>
        {mobileExcerpt && (
          <p className="au-story-excerpt au-story-mobile-excerpt">
            “{story.mobileExcerpt}”
          </p>
        )}
        <small className="au-story-translation">
          {koreanOriginal ? (story.original ? '한국어 원문' : '사진 후기 · 작성된 내용 없음') : story.translated
            ? 'English translation · excerpt'
            : story.originalLanguage === 'English'
              ? 'Original English review'
              : 'Photo review · no written text'}
        </small>
        {story.translated && !koreanOriginal && (
          <div className="au-story-original-preview" lang="ko">
            <small>KOREAN ORIGINAL</small>
            <p>{story.original}</p>
          </div>
        )}
        <div className="au-story-meta">
          <span>{story.nickname}</span>
          <time dateTime={story.date}>{storyDate(story.date, language)}</time>
        </div>
        {!photo && <small>{storySource(story)}</small>}
        <button className="au-story-read" type="button" onClick={onOpen}>
          {t('Read full review', '후기 전체 보기')} <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}
export function StoryDialog({
  story,
  onClose,
}: {
  story: CustomerStory | null
  onClose: () => void
}) {
  const { language, t } = useAuLanguage()
  const koreanOriginal = language === 'ko' && story?.originalLanguage !== 'English'
  const dialog = useRef<HTMLDialogElement>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => {
    const element = dialog.current
    if (!story || !element) return
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = old
      opener?.focus()
    }
  }, [story])
  if (!story) return null
  const photo = story.photos[photoIndex] || story.photos[0]
  return (
    <dialog
      ref={dialog}
      className="au-story-dialog"
      aria-modal="true"
      aria-labelledby="au-story-dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return
        const controls = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
          ),
        ].filter((node) => node.getClientRects().length)
        const first = controls[0],
          last = controls.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button
        type="button"
        className="au-story-close"
        aria-label={t('Close review', '후기 닫기')}
        autoFocus
        onClick={onClose}
      >
        <X size={22} /> {t('Close', '닫기')}
      </button>
      <div className="au-story-dialog-grid">
        {photo && (
          <div className="au-story-dialog-gallery">
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={`Full customer photo ${photoIndex + 1} of ${story.photos.length}, review ${story.id}`}
            />
            {story.photos.length > 1 && (
              <nav aria-label="Customer photos">
                <button
                  type="button"
                  aria-label={t('Previous photo', '이전 사진')}
                  disabled={photoIndex === 0}
                  onClick={() => setPhotoIndex((i) => i - 1)}
                >
                  <ArrowLeft />
                </button>
                <span>
                  {photoIndex + 1} / {story.photos.length}
                </span>
                <button
                  type="button"
                  aria-label={t('Next photo', '다음 사진')}
                  disabled={photoIndex === story.photos.length - 1}
                  onClick={() => setPhotoIndex((i) => i + 1)}
                >
                  <ArrowRight />
                </button>
              </nav>
            )}
          </div>
        )}
        <div className="au-story-dialog-copy">
          <p className="au-stories-eyebrow">{storySource(story)}</p>
          <h2 id="au-story-dialog-title">
            {story.title || t('A customer story from Korea', '한국 고객의 이야기')}
          </h2>
          <StoryRating rating={story.rating} />
          <p className="au-story-full-text" lang={koreanOriginal ? 'ko' : 'en'}>
            {(koreanOriginal ? story.original : story.english) ||
              t('This customer shared photos without a written review.', '작성된 내용 없이 사진을 남겨주신 후기입니다.')}
          </p>
          <small>
            {koreanOriginal ? '한국어 원문' : story.translated
              ? 'English translation'
              : story.originalLanguage === 'English'
                ? 'Original English review'
                : 'Photo review'}
          </small>
          {story.translated && (
            <div className="au-story-original">
              <h3>{koreanOriginal ? '영어 번역' : 'Korean original'}</h3>
              <p lang={koreanOriginal ? 'en' : 'ko'}>{koreanOriginal ? story.english : story.original}</p>
            </div>
          )}
          <p>
            {story.nickname} ·{' '}
            <time dateTime={story.date}>{storyDate(story.date, language)}</time>
          </p>
          <p className="au-stories-disclosure">
            {t('Selected reviews from our Korean store, not reviews of Australian orders.', '한국 매장에서 선별한 후기이며, 호주 주문에 대한 후기가 아닙니다.')}
          </p>
        </div>
      </div>
    </dialog>
  )
}
export function HomeCustomerStories() {
  const { t } = useAuLanguage()
  const [selected, setSelected] = useState<CustomerStory | null>(null)
  const [lastPair, setLastPair] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  return (
    <section
      className="au-stories au-stories-home"
      aria-labelledby="home-stories-title"
    >
      <header className="au-stories-heading">
        <div>
          <p className="au-stories-eyebrow">{t('REAL CUSTOMER STORIES FROM KOREA', '한국 고객이 남겨주신 실제 후기')}</p>
          <h2 id="home-stories-title">{t('GOOD WORDS, SHARED.', '고객이 전하는 이야기')}</h2>
          <p>{t('Real experiences, shared by our customers in Korea.', '한국 고객들이 직접 남겨주신 경험을 전합니다.')}</p>
        </div>
        <a className="au-stories-top-link" href="/customer-stories/korea">
          {t('VIEW ALL CUSTOMER STORIES', '후기 전체 보기')} <ArrowUpRight size={16} />
        </a>
      </header>
      <div
        className="au-stories-home-grid"
        ref={row}
        onScroll={(e) => setLastPair(e.currentTarget.scrollLeft > 30)}
      >
        {featured.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            compact
            onOpen={() => setSelected(story)}
          />
        ))}
      </div>
      <div className="au-stories-carousel-controls">
        <div aria-label="Cards in view">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={(lastPair ? i > 0 : i < 2) ? 'is-visible' : ''}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            row.current?.scrollTo({
              left: lastPair ? 0 : row.current.scrollWidth,
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            })
          }
        >
          {lastPair ? t('BACK TO FIRST STORIES', '첫 후기로 돌아가기') : t('SWIPE TO EXPLORE', '넘겨서 더 보기')}{' '}
          <ArrowRight size={13} />
        </button>
      </div>
      <a className="au-stories-mobile-link" href="/customer-stories/korea">
        {t('VIEW ALL CUSTOMER STORIES', '후기 전체 보기')} <ArrowUpRight size={16} />
      </a>
      <footer className="au-stories-disclosure">
        {t('Selected customer reviews from Korea · English translations where applicable.', '한국 고객의 선정 후기 · 해당 후기의 영어 번역 제공')}
        <br />
        {t('Selected reviews from our Korean store, not reviews of Australian orders.', '한국 매장에서 선별한 후기이며, 호주 주문에 대한 후기가 아닙니다.')}
      </footer>
      <StoryDialog
        key={selected?.id ?? 'closed'}
        story={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  )
}
