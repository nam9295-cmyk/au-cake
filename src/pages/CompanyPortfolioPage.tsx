import { useEffect } from 'react'

const assets = '/portfolio/editorial/'
const demo = 'https://invite.verygood-chocolate.com/gallery/chocolate-collage'
const instagram = 'https://www.instagram.com/verygood_syd/'

function Photo({ name, alt, caption }: { name: string; alt: string; caption?: string }) {
  return <figure><picture>
    <source media="(max-width: 650px)" srcSet={assets + name + '-mobile.webp'} />
    <img src={assets + name + '-wide.webp'} alt={alt} loading={name === 'hero' ? 'eager' : 'lazy'} />
  </picture>{caption && <figcaption>{caption}</figcaption>}</figure>
}

export default function CompanyPortfolioPage() {
  useEffect(() => {
    const follow = () => document.getElementById(location.hash.slice(1))?.scrollIntoView()
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])
  return <main className="company-portfolio" lang="en-AU">
    <nav aria-label="Portfolio sections"><a href="#sharing">Celebrations</a><a href="#consulting">Consulting</a>
      <a href="#invitations">Invitations</a><a href="#about">About</a><a className="pf-button" href="#enquire">Get in touch</a></nav>
    <section id="daily-chocolate">
      <p className="pf-label">VERY GOOD CHOCOLATE / SYDNEY</p>
      <div className="pf-heading"><h1>Cakes for gatherings.<br />Ideas for cafés.</h1><p>Handcrafted cakes and treats in Sydney, thoughtful café consulting, and digital invitations in beta.</p></div>
      <Photo name="hero" alt="Chocolate and pastry from the Very Good atelier" caption="Chocolate, cake and care for the details." />
      <div className="pf-paths"><a href="#sharing"><small>01</small>Celebrations &amp; group orders</a><a href="#consulting"><small>02</small>Café &amp; bakery consulting</a><a href="#invitations"><small>03 · Beta preview</small>Digital invitations</a></div>
    </section>
    <section id="about" className="pf-grid">
      <div><p className="pf-label">THE CHEF &amp; FOUNDER</p><h2>Meet Jenny.</h2><h3>Paris-trained pastry chef &amp; chocolatier. Crafting in Sydney.</h3>
        <p>After training at Le Cordon Bleu and École Ritz Escoffier in Paris, Jenny honed her pastry and chocolate craft across five-star hotels and luxury showcases. Today, she bakes every recipe from our Melrose Park kitchen.</p>
        <p className="pf-signature">Classic French craft. Shared in Sydney.</p></div>
      <Photo name="jenny" alt="Chocolate gâteau loaf from Jenny’s kitchen" caption="Chocolate gâteau loaf, baked fresh in Melrose Park" />
    </section>
    <section id="sharing"><p className="pf-label">01 / CELEBRATIONS &amp; GROUP ORDERS</p>
      <div className="pf-heading"><h2>Something good<br />to share.</h2><p>A centrepiece cake for the table, or individually packaged treats for every guest. Tell us your date and guest count—we’ll find the mix that fits your occasion.</p></div>
      <div className="pf-grid"><div id="custom-cakes"><Photo name="cake" alt="Pavé chocolate celebration cake" caption="Pavé chocolate cake: rich, neat, made to share." /></div>
        <div id="individual-packs"><Photo name="gifts" alt="Individually packaged guest favours" /><h3>A little thank-you for every guest.</h3><p>Individual treats and custom-labelled packaging, agreed together.</p></div></div>
      <div className="pf-line"><p>Share your date, guest numbers, and the feeling you’d like to create.</p><a href="#enquire">Plan your gathering ↗</a></div>
    </section>
    <section id="business"><div className="pf-grid" id="consulting"><div><p className="pf-label">02 / CAFÉ &amp; BAKERY CONSULTING</p><h2>Practical pastry craft for Sydney cafés.</h2>
      <p>Whether refining your counter display, introducing a signature dessert, or training your team to bake with consistency—we start with an honest conversation.</p>
      <Photo name="consult" alt="Pastry and chocolate for a café counter" /><a href="#enquire">Discuss a café project ↗</a></div>
      <div id="wholesale"><p className="pf-label">POSSIBLE AREAS TO DISCUSS</p>
        <h3>Menu &amp; recipe direction</h3><p>Refining signature baked goods that fit your kitchen workflow and coffee menu.</p>
        <h3>Product &amp; presentation</h3><p>Balancing visual counter appeal, portioning standards, and packaging.</p>
        <h3>Practical training</h3><p>Hands-on kitchen coaching so your staff produce consistent results every morning.</p><small>Scope agreed after an initial conversation.</small></div></div>
    </section>
    <section id="invitations" className="pf-grid"><div><p className="pf-label">03 / DIGITAL INVITATIONS</p>
      <h2>Before the cake is cut, there is an invitation.</h2><h3>A celebration begins long before guests arrive at the table.</h3>
      <p className="pf-label">BETA PREVIEW</p><p>VERYGOOD Invitations is our new digital service for children’s birthdays, milestones and celebration gatherings—simple, thoughtful, and free to try online.</p>
      <a href={demo} target="_blank" rel="noreferrer">Explore Chocolate Collage demo ↗</a></div>
      <a className="pf-demo" href={demo} target="_blank" rel="noreferrer" aria-label="Open the Chocolate Collage invitation demo">
        <img src={assets + 'paper.webp'} alt="" loading="lazy" /><Photo name="phone" alt="Chocolate Collage digital invitation preview" /></a>
    </section>
    <section><p className="pf-label">SELECTED FROM OUR COLLECTION</p><div className="pf-line"><h2>From our daily bakehouse.</h2><a href="/cakes">Explore our full shop collection ↗</a></div>
      <div className="pf-grid"><Photo name="chocolate" alt="Artisan chocolate for gifting" caption="Artisan chocolate & gifting: hand-poured in Sydney" />
        <Photo name="cupcakes" alt="Petite bakes and cupcakes" caption="Petite bakes & cupcakes: fresh for celebration tables" /></div></section>
    <section id="enquire"><p className="pf-label">A CONVERSATION IS A GOOD PLACE TO START</p><div className="pf-heading"><h2>Have something<br />in mind?</h2>
      <div><p>Whether it’s a cake for an upcoming gathering, an idea for your café, or questions about the invitation project—we’re always happy to talk.</p>
      <a className="pf-button" href={instagram}>Message @verygood_syd ↗</a><p><small>Current enquiry channel · Instagram<br />Melrose Park, Sydney</small></p></div></div></section>
  </main>
}
