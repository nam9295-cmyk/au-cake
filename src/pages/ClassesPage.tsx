import kidsClassHeroImg from '../assets/kids-class-hero.webp'
import kidsClassProcessImg from '../assets/kids-class-process.webp'
import kidsClassFinishedImg from '../assets/kids-class-finished.webp'
import PublicReviewsSection from '../PublicReviewsSection'
import { SiteHeader } from '../components/SiteChrome'
import { appwriteConfig, functions } from '../lib/appwrite'
import { type Page } from '../lib/app-routes'
import { type Language } from '../lib/i18n'
import { getAuPublicContent, getPublicRoutePage } from '../lib/public-content'
import { formatCurrency } from '../lib/utils'

export function ClassesPage({ navigate, language, setLanguage, cartItemCount }: { navigate: (page: Page) => void; language: Language; setLanguage: (language: Language) => void; cartItemCount: number }) {
  const publicPage = getPublicRoutePage('/classes')!
  const publicClassContent = getAuPublicContent().classes
  const essentials = [
    ['Basic from Kindy', 'Kindy–Year 2 and Year 3–6 school groups'],
    ['Professional-style course', 'Real studio guidance from planning to finishing'],
    ['Basic and Advanced', 'Start with a 15cm cake or cupcakes, then progress to a 2-tier cake'],
    ['Weekend classes', 'Saturday and Sunday sessions with Jenny'],
    ['Max 2 kids per session', 'Private small group focus'],
  ]
  const steps = [
    ['Choose a course', 'Select the age group, date, and studio session time.'],
    ['Imagine your cake', 'Sketch the cake from your imagination and plan the shape, colour, and finish.'],
    ['Bring it to life', 'Build your chocolate cake with professional guidance from Jenny.'],
    ['Box and take home', 'Pack your finished cake beautifully and take it home safely.'],
  ]

  return (
    <>
      <SiteHeader navigate={navigate} language={language} setLanguage={setLanguage} cartItemCount={cartItemCount} />
      <main className="kids-class-page">
        <section className="kids-class-hero" aria-labelledby="kids-class-title">
          <div className="kids-hero-copy reveal-up">
            <h1 id="kids-class-title">{publicPage.h1}</h1>
            <p className="kids-location">Melrose Park, Sydney</p>
            <p className="kids-hero-text">
              {publicPage.intro}
            </p>
            <div className="kids-hero-actions">
              <button className="kids-primary-button" type="button" onClick={() => navigate('class-reserve')}>
                Request a spot
              </button>
              <span>Basic: Kindy–Year 6 · Advanced: Year 2–6 · Weekend sessions</span>
            </div>
          </div>

          <div className="kids-photo-card reveal-up delay-one">
            <img src={kidsClassHeroImg} alt="Kids professional cake course hero" />
          </div>
        </section>

        <section className="kids-section reveal-up delay-two" aria-labelledby="class-essentials-title">
          <h2 id="class-essentials-title">Class Essentials</h2>
          <div className="kids-essentials-grid">
            {essentials.map(([title, text]) => (
              <article className="kids-mini-card" key={title}>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kids-section reveal-up" aria-labelledby="course-choices-title">
          <h2 id="course-choices-title">Choose a Course</h2>
          <div className="kids-step-grid">
            <article className="kids-step-card">
              <strong>Basic Cake Class</strong>
              <p>Kindy–Year 6 · Plan, build, and finish one 15cm chocolate cake to take home.</p>
            </article>
            <article className="kids-step-card">
              <strong>Basic Cupcakes & Chocolate Class</strong>
              <p>Kindy–Year 6 · Make four cupcakes and enjoy a guided hands-on chocolate-making activity.</p>
            </article>
            <article className="kids-step-card">
              <strong>Advanced 2-Tier Cake Class</strong>
              <p>Year 2–6 · A 120-minute, one-child class for building and finishing a two-tier cake.</p>
            </article>
          </div>
        </section>

        <section className="kids-section reveal-up" aria-labelledby="how-it-works-title">
          <h2 id="how-it-works-title">How it works</h2>
          <div className="kids-step-grid">
            {steps.map(([title, text]) => (
              <article className="kids-step-card" key={title}>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="kids-gallery-section reveal-up" aria-label="Kids class photos">
          <figure className="kids-gallery-card kids-gallery-process">
            <img src={kidsClassProcessImg} alt="Kids class cake making process" />
            <figcaption>
              <strong>Studio process</strong>
              <span>Plan, layer, cream, and finish with guided hands-on steps.</span>
            </figcaption>
          </figure>
          <figure className="kids-gallery-card kids-gallery-finished">
            <img src={kidsClassFinishedImg} alt="Finished kids cake class chocolate cake" />
            <figcaption>
              <strong>Finished cake</strong>
              <span>A real chocolate cake boxed beautifully to take home.</span>
            </figcaption>
          </figure>
        </section>

        <section className="kids-bottom-grid reveal-up" aria-label="Pricing and safety information">
          <article className="kids-price-card">
            <h2>Price Guide</h2>
            <p className="kids-price-line">
              Base course/package range · {formatCurrency(publicClassContent.baseLowPrice)}–
              {formatCurrency(publicClassContent.baseHighPrice).replace('AUD ', '')}
            </p>
            <strong>Basic · Kindy–Year 2 {formatCurrency(99)}</strong>
            <p className="kids-price-line">Basic · Year 3–6 {formatCurrency(109)}</p>
            <p className="kids-price-line">Advanced {formatCurrency(159)} · one child</p>
            <p className="kids-price-line">{publicClassContent.packageSummary}</p>
            <p className="kids-small-note">{publicClassContent.extensionSummary}</p>
            <p className="kids-small-note">
              * Booking is completed after availability and full payment are confirmed by Jenny.
            </p>
          </article>

          <article className="kids-safety-card">
            <h2>Safety & Allergy Policy</h2>
            <p>
              This is a short private cake decorating class, not childcare. Younger children may need a parent or guardian to stay nearby or join the session.
            </p>
            <ul>
              <li>All allergies and dietary requirements must be declared before booking confirmation</li>
              <li>Parent/guardian consent is required when submitting a booking request</li>
              <li>Detailed address shared after payment confirmation (Melrose Park, Sydney)</li>
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

        <section className="kids-final-cta reveal-up" aria-label="Request class booking">
          <p>Weekend spots are handled manually so Jenny can confirm each class safely.</p>
          <button className="kids-primary-button" type="button" onClick={() => navigate('class-reserve')}>
            Request a spot
          </button>
        </section>
      </main>
    </>
  )
}
