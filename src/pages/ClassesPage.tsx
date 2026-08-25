import kidsClassHeroImg from '../assets/kids-class-hero.webp'
import kidsClassProcessImg from '../assets/kids-class-process.webp'
import kidsClassFinishedImg from '../assets/kids-class-finished.webp'
import PublicReviewsSection from '../PublicReviewsSection'
import { SiteHeader } from '../components/SiteChrome'
import { appwriteConfig, functions } from '../lib/appwrite'
import { type Page } from '../lib/app-routes'
import { getSpringClassCampaignCopy } from '../lib/class-campaign'
import { getClassPageCopy, type Language } from '../lib/i18n'
import { getAuPublicContent } from '../lib/public-content'
import { formatCurrency } from '../lib/utils'

export function ClassesPage({ navigate, language, setLanguage, cartItemCount }: { navigate: (page: Page) => void; language: Language; setLanguage: (language: Language) => void; cartItemCount: number }) {
  const copy = getClassPageCopy(language)
  const publicClassContent = getAuPublicContent().classes
  const campaignCopy = getSpringClassCampaignCopy(language)

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
      <main className="kids-class-page">
        <section className="kids-class-hero" aria-labelledby="kids-class-title">
          <div className="kids-hero-copy reveal-up">
            <h1 id="kids-class-title">{copy.landing.title}</h1>
            <p className="kids-location">{copy.landing.location}</p>
            <p className="kids-hero-text">{copy.landing.intro}</p>
            <div className="kids-hero-actions">
              <button className="kids-primary-button" type="button" onClick={() => navigate('class-reserve')}>
                {copy.landing.requestSpot}
              </button>
              <span>{copy.landing.courseSummary}</span>
            </div>
            <aside className="spring-class-callout" aria-label={campaignCopy.calloutTitle}>
              <strong>{campaignCopy.calloutTitle}</strong>
              <span>{campaignCopy.calloutDates}</span>
              <span>{campaignCopy.calloutSessions}</span>
            </aside>
          </div>

          <div className="kids-photo-card reveal-up delay-one">
            <img src={kidsClassHeroImg} alt={copy.landing.heroImageAlt} />
          </div>
        </section>

        <section className="kids-section reveal-up delay-two" aria-labelledby="class-essentials-title">
          <h2 id="class-essentials-title">{copy.landing.essentialsTitle}</h2>
          <div className="kids-essentials-grid">
            {copy.landing.essentials.map(({ title, text }) => (
              <article className="kids-mini-card" key={title}>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kids-section reveal-up" aria-labelledby="course-choices-title">
          <h2 id="course-choices-title">{copy.landing.courseTitle}</h2>
          <div className="kids-step-grid">
            {copy.landing.courseCards.map(({ title, text }) => (
              <article className="kids-step-card" key={title}>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kids-section reveal-up" aria-labelledby="how-it-works-title">
          <h2 id="how-it-works-title">{copy.landing.stepsTitle}</h2>
          <div className="kids-step-grid">
            {copy.landing.steps.map(({ title, text }) => (
              <article className="kids-step-card" key={title}>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kids-gallery-section reveal-up" aria-label={copy.landing.galleryLabel}>
          <figure className="kids-gallery-card kids-gallery-process">
            <img src={kidsClassProcessImg} alt={copy.landing.processImageAlt} />
            <figcaption>
              <strong>{copy.landing.processTitle}</strong>
              <span>{copy.landing.processText}</span>
            </figcaption>
          </figure>
          <figure className="kids-gallery-card kids-gallery-finished">
            <img src={kidsClassFinishedImg} alt={copy.landing.finishedImageAlt} />
            <figcaption>
              <strong>{copy.landing.finishedTitle}</strong>
              <span>{copy.landing.finishedText}</span>
            </figcaption>
          </figure>
        </section>

        <section className="kids-bottom-grid reveal-up" aria-label={copy.landing.pricingSafetyLabel}>
          <article className="kids-price-card">
            <h2>{copy.landing.priceGuideTitle}</h2>
            <p className="kids-price-line">
              {copy.landing.baseRangeLabel} · {formatCurrency(publicClassContent.baseLowPrice)}–
              {formatCurrency(publicClassContent.baseHighPrice).replace('AUD ', '')}
            </p>
            <strong>{copy.landing.basicYoungerLabel} {formatCurrency(99)}</strong>
            <p className="kids-price-line">{copy.landing.basicOlderLabel} {formatCurrency(109)}</p>
            <p className="kids-price-line">{copy.landing.advancedLabel} {formatCurrency(159)} · {copy.landing.oneChild}</p>
            <p className="kids-price-line">{language === 'ko' ? copy.landing.packageSummary : publicClassContent.packageSummary}</p>
            <p className="kids-small-note">{language === 'ko' ? copy.landing.extensionSummary : publicClassContent.extensionSummary}</p>
            <p className="kids-small-note">{copy.landing.confirmationNote}</p>
          </article>

          <article className="kids-safety-card">
            <h2>{copy.landing.safetyTitle}</h2>
            <p>{copy.landing.safetyText}</p>
            <ul>
              {copy.landing.safetyPoints.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </article>
        </section>

        <PublicReviewsSection
          language={language}
          executor={functions}
          functionId={appwriteConfig.reviewApiFunctionId}
          functionEndpoint={appwriteConfig.publicEndpoint}
          onViewAll={() => navigate('reviews')}
          demoEnabled={import.meta.env.VITE_REVIEW_DEMO_MODE === 'true'}
          development={import.meta.env.DEV}
        />

        <section className="kids-final-cta reveal-up" aria-label={copy.landing.finalCtaLabel}>
          <p>{copy.landing.finalCtaText}</p>
          <button className="kids-primary-button" type="button" onClick={() => navigate('class-reserve')}>
            {copy.landing.requestSpot}
          </button>
        </section>
      </main>
    </>
  )
}
