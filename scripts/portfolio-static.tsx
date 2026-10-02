import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CompanyPortfolioPage from '../src/pages/CompanyPortfolioPage'
import { AuRedesignHeader, AuRedesignFooter } from '../src/components/AuRedesignChrome'

// Reuse the actual page, including its responsive DOM. There is no second copy
// of the content or a separate mobile/static template to keep in sync.
export function renderPortfolio() {
  return renderToStaticMarkup(createElement('div', { className: 'app-shell au-redesign-shell' },
    createElement(AuRedesignHeader, { cartItemCount: 0 }),
    createElement(CompanyPortfolioPage),
    createElement(AuRedesignFooter),
  ))
}
