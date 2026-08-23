import { useCallback, useEffect, useRef, useState } from 'react'
import {
  dismissSpringClassPopup,
  getSpringClassCampaignCopy,
  isSpringClassCampaignActive,
  isSpringClassPopupDismissed,
} from '../lib/class-campaign'
import type { Language } from '../lib/i18n'

function readableSessionStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function SpringClassCampaignDialog({ language, onBook }: { language: Language; onBook: () => void }) {
  const [open, setOpen] = useState(() => (
    isSpringClassCampaignActive()
    && !isSpringClassPopupDismissed(readableSessionStorage())
  ))
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const copy = getSpringClassCampaignCopy(language)

  const close = useCallback(() => {
    dismissSpringClassPopup(readableSessionStorage())
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [close, open])

  if (!open) return null

  return (
    <div className="spring-class-popup-backdrop">
      <section
        className="spring-class-popup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spring-class-dialog-title"
        aria-describedby="spring-class-dialog-description"
      >
        <button
          ref={closeButtonRef}
          className="spring-class-popup-close"
          type="button"
          aria-label={language === 'ko' ? '봄방학 클래스 안내 닫기' : 'Close spring class announcement'}
          onClick={close}
        >
          ×
        </button>
        <p className="spring-class-popup-eyebrow">{copy.eyebrow}</p>
        <h2 id="spring-class-dialog-title">{copy.title}</h2>
        <p id="spring-class-dialog-description" className="spring-class-popup-body">{copy.body}</p>
        <ul className="spring-class-popup-dates">
          {copy.dates.map((date) => <li key={date}>{date}</li>)}
        </ul>
        <p className="spring-class-popup-sessions">{copy.sessions}</p>
        <p className="spring-class-popup-note">{copy.note}</p>
        <div className="spring-class-popup-actions">
          <button type="button" className="spring-class-popup-primary" onClick={() => {
            close()
            onBook()
          }}>
            {copy.primaryCta}
          </button>
          <button type="button" className="spring-class-popup-secondary" onClick={close}>
            {copy.secondaryAction}
          </button>
        </div>
      </section>
    </div>
  )
}
