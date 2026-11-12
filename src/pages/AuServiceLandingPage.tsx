import { useState, useEffect } from 'react'
import { CustomCakeMenuCards } from '../components/CustomCakeMenuCards'
import { CUSTOM_CAKE_MENU, getCustomCakeInitialTier } from '../lib/custom-cake-menu'
import { ArrowUpRight } from 'lucide-react'
import services from '../content/au-business-services.json'
import assets from '../content/au-service-assets.json'
import koreanCopy from '../content/au-service-copy.ko.json'
import publicContent from '../content/au-public-pages.json'
import { useAuLanguage } from '../lib/au-language'

const instagram = publicContent.site.socialProfiles.find((url) => url.startsWith('https://www.instagram.com/'))!

export function AuServiceLandingPage({ kind }: { kind: 'custom-cakes' | 'business' }) {
  const { language, t } = useAuLanguage()
  const [search, setSearch] = useState(() => typeof window === 'undefined' ? '' : window.location.search)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const sync = () => { setSearch(window.location.search); setCopied(false) }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  useEffect(() => {
    if (kind !== 'custom-cakes' || new URLSearchParams(search).get('service') !== 'private-class') return
    // The native fragment jump can happen before React creates this conditional section.
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('private-class-enquiry')?.scrollIntoView({ block: 'start' })
      document.getElementById('private-class-title')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [kind, search])
  const selectedClass = CUSTOM_CAKE_MENU.find(menu => menu.kind === 'private-class' && menu.tier === getCustomCakeInitialTier(search))!
  const className = language === 'ko' ? selectedClass.nameKo : selectedClass.nameEn
  const enquiryText = t(`Hello, I'd like to enquire about ${selectedClass.nameEn}.`, `${selectedClass.nameKo} 수업을 문의하고 싶습니다.`)
  const copy = (text: string) => language === 'ko' ? (koreanCopy as Record<string, string>)[text] || text : text
  const paused = t(
    'Currently paused. Next school holiday dates will be announced once confirmed.',
    '현재 휴강 중입니다. 다음 방학 일정은 확정 후 안내합니다.',
  )
  const businessServices = ['cafe-supply', 'events', 'consulting'].map((slug) => services.pages.find((page) => page.slug === slug)!)
  const photoAlts: Record<string, string> = {
    'cafe-supply': '베리굿 카드와 함께 개별 포장한 컵케이크',
    events: '모임을 위해 준비한 케이크, 컵케이크와 초콜릿',
    consulting: '작업대에서 케이크와 컵케이크를 준비하는 모습',
  }

  return (
    <main className={kind === "custom-cakes" ? "renewal-page renewal-collection au-custom-collection" : "au-service-landing au-service-landing-business"}>
      {kind === 'custom-cakes' ? (
        <>
          <h1 id="service-title">{t('Custom Cakes', '커스텀 케이크')}</h1>
          <CustomCakeMenuCards collection />
          {new URLSearchParams(search).get('service') === 'private-class' && <section id="private-class-enquiry" className="au-private-class-enquiry" aria-labelledby="private-class-title">
            <h2 id="private-class-title" tabIndex={-1}>{className}</h2>
            <p>{t('Enquire for pricing', '수업료 문의')}</p>
            <p>{t('Contact us to discuss class details and availability.', '수업 내용과 가능 일정은 문의 후 안내합니다.')}</p>
            <p>{enquiryText}</p>
            <button className="au-service-button" type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(enquiryText); setCopied(true) } catch { setCopied(false) }
            }}>{t('Copy enquiry text', '문의 문구 복사')}</button>
            <span role="status">{copied ? t('Copied', '복사했습니다') : ''}</span>
            <a className="au-service-text-link" href={instagram} target="_blank" rel="noreferrer">{t('Enquire on Instagram', '인스타그램으로 문의')}</a>
          </section>}
          <section className="au-service-classes" aria-labelledby="service-classes-title">
            <div className="au-service-class-heading">
              <h2 id="service-classes-title">{t('Kids Classes', '키즈 클래스')}</h2>
              <p className="au-service-pause">{paused}</p>
            </div>
            <div className="au-service-class-grid">
              <article>
                <h3>{t('Basic · One-tier cake', 'Basic · 1단 케이크')}</h3>
                <p>{t(
                  'Plan, build and finish a chocolate cake. A look back at our one-tier cake class.',
                  '초콜릿 케이크를 구상하고 만들고 꾸미는 1단 케이크 수업의 기록입니다.',
                )}</p>
              </article>
              <article>
                <h3>{t('Advanced · Two-tier cake', 'Advanced · 2단 케이크')}</h3>
                <p>{t(
                  'Build and finish a two-tier cake. A look back at our advanced cake class.',
                  '2단 케이크를 쌓고 꾸미는 어드밴스드 케이크 수업의 기록입니다.',
                )}</p>
              </article>
            </div>
            <a className="au-service-text-link" href="/classes">
              {t('View class archive', '클래스 아카이브 보기')}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </section>
        </>
      ) : (
        <>
          <header className="au-service-intro">
            <h1 id="service-title">{t('Business', '비즈니스')}</h1>
            <p>{t(
              'Explore our event, café supply and consulting services.',
              '행사, 카페 공급 및 컨설팅 서비스를 소개합니다.',
            )}</p>
          </header>
          <div className="au-service-business-grid">
            {businessServices.map((service) => {
              const photo = assets[service.hero as keyof typeof assets]
              return <article key={service.slug}>
                <img src={photo.variants[0].src}
                  srcSet={photo.variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')}
                  sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) 30vw, 384px"
                  alt={t(photo.alt, photoAlts[service.slug])} width={photo.width} height={photo.height}
                  loading="lazy" decoding="async" />
                <div className="au-service-business-copy">
                  <p className="au-service-status">{copy(service.status)}</p>
                  <h2>{copy(service.title)}</h2>
                  <p>{copy(service.intro)}</p>
                  <a className="au-service-text-link" href={`/business/${service.slug}`}>
                    {t('Explore service', '서비스 자세히 보기')}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </article>
            })}
          </div>
        </>
      )}
      <section className="au-service-contact" aria-labelledby="service-contact-title">
        <div>
          <h2 id="service-contact-title">{t('Enquiries', '문의')}</h2>
          <p>{t('Message @verygood_syd to discuss your ideas.', '아이디어를 나누고 싶다면 @verygood_syd로 메시지를 보내주세요.')}</p>
        </div>
        <a className="au-service-text-link" href={instagram} target="_blank" rel="noreferrer">
          {t('Enquire on Instagram', '인스타그램으로 문의')}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </section>
    </main>
  )
}
