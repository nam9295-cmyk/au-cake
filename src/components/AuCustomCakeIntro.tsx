import { AuBreadcrumb } from './AuRedesignChrome'
import { auEditorialImages } from '../lib/au-catalog'

const steps = [
  ['SEND 3 REFERENCES', 'Prepare three images that express the mood, colours and style you love. Share them with us after your request is received.'],
  ['TELL US THE OCCASION', 'Tell us about the celebration, your preferred date and the number of guests.'],
  ['WE DESIGN FOR YOU', 'We interpret your inspirations to create an original cake for your occasion.'],
  ['RECEIVE YOUR QUOTE', 'We review your design and availability, then confirm the quote and pick-up details with you.'],
] as const

export function AuCustomCakeIntro() {
  return <div className="au-redesign-custom-intro" data-au-template="custom">
    <AuBreadcrumb><span>CUSTOM & BESPOKE CAKES</span></AuBreadcrumb>
    <section className="au-redesign-custom-hero">
      <img src={auEditorialImages.custom} alt="Custom celebration cakes" width={2160} height={1012} />
      <div><p className="au-redesign-kicker">BESPOKE ATELIER COMMISSIONS</p><h1>CUSTOM CAKES</h1>
        <p>For life's most meaningful moments. Individually designed for your celebration's mood and purpose.</p>
        <div className="au-redesign-design-principle"><h2>OUR DESIGN PRINCIPLE</h2><p>We do not reproduce another designer's cake exactly. Your references help us understand the mood, colours and style you love, so we can create an original design for you.</p></div>
        <a className="au-redesign-primary-link" href="#custom-cake-options">START CUSTOM CAKE INQUIRY →</a>
        <p className="au-redesign-microcopy">No payment is taken now. Final pricing and availability are confirmed after reviewing your request.</p>
      </div>
    </section>
    <section className="au-redesign-process"><h2>HOW OUR BESPOKE PROCESS WORKS</h2><ol>{steps.map(([title, body], index) => <li key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol></section>
    <section className="au-redesign-occasions"><h2>COMMISSIONS BY OCCASION</h2><div>{[
      ['BIRTHDAY', auEditorialImages.celebration], ['MILESTONE CELEBRATIONS', auEditorialImages.custom],
      ['WEDDING', '/products/fresh-strawberry-vanilla-cream-cake-sydney.webp'], ['CORPORATE EVENT', auEditorialImages.craft],
    ].map(([title, image]) => <figure key={title}><img src={image} alt={`${title} — editorial reference`} loading="lazy" width={640} height={480} /><figcaption>{title}</figcaption></figure>)}</div></section>
  </div>
}
