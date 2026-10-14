import { RENEWAL_NAV } from '../../appwrite-functions/reservation-api/src/au-renewal-catalog.js'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { AuLanguageToggle } from './AuLanguage'
import { useAuLanguage } from '../lib/au-language'

const primary = RENEWAL_NAV.map(link => ({ ...link, description: link.en, koreanDescription: link.ko }))

export function AuNavigation({
  cartItemCount,
  home = false,
}: {
  cartItemCount: number
  home?: boolean
}) {
  const { t } = useAuLanguage()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    element.showModal()
    const previous = document.body.style.overflow
    const trigger = opener.current
    document.body.style.overflow = 'hidden'
    const desktop = window.matchMedia('(min-width: 1100px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      element.close()
      document.body.style.overflow = previous
      desktop.removeEventListener('change', closeOnDesktop)
      trigger?.focus()
    }
  }, [open])
  const brand = (
    <a className="au-v02-wordmark" href="/">
      VERYGOOD <span>· SYDNEY</span>
    </a>
  )
  const bag = (
    <a
      className="au-v02-bag"
      href="/cart"
      aria-label={t(
        `Cart with ${cartItemCount} items`,
        `장바구니 ${cartItemCount}개`,
      )}
    >
      BAG ({cartItemCount})
    </a>
  )
  return (
    <header
      className={`au-v02-header ${home ? 'rd-header' : 'au-redesign-header'}`}
    >
      {brand}
      <nav className="au-v02-primary" aria-label="Main navigation">
        {primary.map((link) => (
          <a key={link.href} href={link.href}>
            {t(link.en, link.ko)}
          </a>
        ))}
      </nav>
      <div className="au-v02-actions">
        <span className="au-v02-studio">MELROSE PARK STUDIO</span>
        <AuLanguageToggle />
        {bag}
        <button
          ref={opener}
          className="au-v02-menu-button"
          type="button"
          aria-label={t('Open menu', '메뉴 열기')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="au-v02-menu"
          onClick={() => setOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>
      <dialog
        id="au-v02-menu"
        className="au-v02-menu"
        ref={dialog}
        aria-label={t('Menu', '메뉴')}
        onCancel={(event) => {
          event.preventDefault()
          setOpen(false)
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled])',
            ),
          ].filter((element) => element.getClientRects().length > 0)
          const first = controls[0],
            last = controls.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
      >
        <div className="au-v02-menu-panel">
          <div className="au-v02-menu-top">
            {brand}
            {bag}
            <button
              type="button"
              autoFocus
              aria-label={t('Close menu', '메뉴 닫기')}
              onClick={() => setOpen(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className="au-v02-menu-location">MELROSE PARK ATELIER · SYDNEY</p>
          <nav className="au-v02-menu-links" aria-label="Mobile navigation">
            {primary.map((link) => (
              <a
                className={
                  link.href === '/cakes/custom-cake'
                    ? 'au-v02-custom-link'
                    : undefined
                }
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
              >
                <span>
                  <strong>{t(link.en, link.ko)}</strong>
                  <small>{t(link.description, link.koreanDescription)}</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            ))}
          </nav>
          <div className="au-v02-menu-secondary">
            <a href="/classes" onClick={() => setOpen(false)}>
              {t('Kids Classes', '키즈 클래스')}{' '}
              <small>{t('Temporarily Paused', '일시 휴강')}</small>
            </a>
            <p>
              {t(
                'Taking a short break. Planned to return next school holidays; dates to be confirmed.',
                '잠시 쉬어갑니다. 다음 방학에 재개할 예정이며 날짜는 추후 안내합니다.',
              )}
            </p>
            <nav aria-label="More navigation"><a href="/#story">{t('Our Story', '브랜드 이야기')}</a>
              <a href="/reviews" onClick={() => setOpen(false)}>
                {t('Reviews', '후기')}
              </a>
              <a href="/lookup" onClick={() => setOpen(false)}>
                {t('Order Lookup', '주문 조회')}
              </a>
            </nav>
          </div>
          <div className="au-v02-menu-bottom">
            <AuLanguageToggle />
            <a
              href="https://www.instagram.com/verygood_syd/"
              target="_blank"
              rel="noreferrer"
            >
              Instagram @verygood_syd
            </a>
          </div>
        </div>
      </dialog>
    </header>
  )
}
