import { renderToStaticMarkup } from 'react-dom/server'
import { AuRedesignFooter } from '../src/components/AuRedesignChrome'
import { AU_PUBLIC_NAV } from '../src/lib/au-public-navigation'
import { AuLanguageContext } from '../src/lib/au-language'

// Static adapter: no fake cart count, dead auth/language buttons, or React startup.
// Native details keeps mobile navigation available even with JavaScript disabled.
export function renderJournalChrome(locale: string) {
  const language = locale === 'ko' ? 'ko' : 'en'
  const links = AU_PUBLIC_NAV.map(link => <a key={link.href} href={link.href}>{language === 'ko' ? link.ko : link.en}</a>)
  return {
    header: renderToStaticMarkup(<>
      <a href="#journal-main" className="journal-skip">{language === 'ko' ? '본문으로 이동' : 'Skip to content'}</a>
      <header className="au-v02-header au-redesign-header journal-header">
        <a className="au-v02-wordmark" href="/">VERYGOOD <span>· SYDNEY</span></a>
        <nav className="au-v02-primary" aria-label="Main navigation">{links}</nav>
        <div className="au-v02-actions">
          <a className="au-v02-bag" href="/cart">{language === 'ko' ? '장바구니' : 'BAG'}</a>
          <details className="journal-mobile-menu"><summary>{language === 'ko' ? '메뉴' : 'Menu'}</summary>
            <nav aria-label="Mobile navigation">{links}<a href="/account">{language === 'ko' ? '마이 계정' : 'My account'}</a><a href="/lookup">{language === 'ko' ? '주문 조회' : 'Order lookup'}</a></nav>
          </details>
        </div>
      </header>
    </>),
    footer: renderToStaticMarkup(<AuLanguageContext.Provider value={{ language, setLanguage() {} }}><AuRedesignFooter /></AuLanguageContext.Provider>),
  }
}
