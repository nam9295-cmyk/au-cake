import { ArrowUpRight } from 'lucide-react'
import services from '../content/au-business-services.json'
import assets from '../content/au-service-assets.json'
import koreanCopy from '../content/au-service-copy.ko.json'
import publicContent from '../content/au-public-pages.json'
import { useAuLanguage } from '../lib/au-language'

const instagram = publicContent.site.socialProfiles.find((url) => url.startsWith('https://www.instagram.com/'))!

export function AuServiceLandingPage({ kind }: { kind: 'custom-cakes' | 'business' }) {
  const { language, t } = useAuLanguage()
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
    <main className={`au-service-landing au-service-landing-${kind}`}>
      {kind === 'custom-cakes' ? (
        <>
          <section className="au-service-intro au-service-custom-intro" aria-labelledby="service-title">
            <div>
              <h1 id="service-title">{t('Custom Cakes', '커스텀 케이크')}</h1>
              <p>{t(
                'Share your date, servings, design ideas and budget. Explore our custom cake portfolio and discuss a cake made for your occasion.',
                '날짜, 인원, 디자인 아이디어와 예산을 알려주세요. 커스텀 케이크 포트폴리오를 둘러보고 특별한 날을 위한 케이크를 문의하세요.',
              )}</p>
              <a className="au-service-button" href="/cakes/custom-cake">
                {t('Custom cake enquiry', '커스텀 케이크 문의')}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <p className="au-service-note">{t(
                'Final pricing and availability are confirmed after reviewing your request.',
                '최종 가격과 제작 가능 여부는 문의 내용을 확인한 후 안내합니다.',
              )}</p>
            </div>
            <img src="/products/custom-cake.webp" alt={t('Colourful custom celebration cakes', '다채로운 커스텀 케이크')}
              width={1080} height={1012} fetchPriority="high" decoding="async" />
          </section>
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
