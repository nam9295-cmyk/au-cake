import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, X } from 'lucide-react'
import { VanillaFreshCreamCakeSilhouette } from './components/SiteChrome'
import type { CakeCatalogCard } from './lib/cake-catalog'
import type { Language } from './lib/i18n'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ProductQuickViewDialog({
  card,
  imageUrl,
  language,
  opener,
  onChooseOptions,
  onClose,
}: {
  card: CakeCatalogCard
  imageUrl: string
  language: Language
  opener: HTMLButtonElement | null
  onChooseOptions: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      if (opener?.isConnected) opener?.focus()
    }
  }, [onClose, opener])

  function onBackdrop(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  return createPortal(
    <div className="product-quick-view-backdrop" onMouseDown={onBackdrop}>
      <div
        ref={dialogRef}
        className="product-quick-view-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <button
          ref={closeRef}
          className="product-quick-view-close"
          type="button"
          onClick={onClose}
          aria-label={language === 'ko' ? '케이크 미리보기 닫기' : 'Close cake quick view'}
        >
          <X aria-hidden="true" size={22} />
        </button>

        <div className="product-quick-view-layout">
          <figure className="product-quick-view-image-wrap">
            {card.isPhotoComingSoon ? (
              <>
                <VanillaFreshCreamCakeSilhouette />
                <span className="product-quick-view-coming-soon">
                  {language === 'ko' ? '사진 준비 중' : 'Photo coming soon'}
                </span>
              </>
            ) : (
              <img src={imageUrl} alt={card.name} width={1080} height={1012} loading="lazy" decoding="async" />
            )}
          </figure>

          <div className="product-quick-view-content">
            <p className="product-quick-view-kicker">{language === 'ko' ? '빠른 미리보기' : 'Quick view'}</p>
            <h2 id={titleId}>{card.name}</h2>
            <p className="product-quick-view-price">{card.priceLabel}</p>
            <p id={descriptionId} className="product-quick-view-description">{card.description}</p>
            <ul className="product-quick-view-features">
              {card.features.slice(0, 3).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button className="primary-button product-quick-view-action" type="button" onClick={onChooseOptions}>
              {language === 'ko' ? '옵션 선택하기' : 'Choose options'}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
