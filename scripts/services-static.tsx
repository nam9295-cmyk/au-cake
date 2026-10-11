import { renderToString } from 'react-dom/server'
import AuBusinessServicePage from '../src/pages/AuBusinessServicePage'
import KoreaCustomerStoriesPage from '../src/pages/KoreaCustomerStoriesPage'
import {
  AuRedesignHeader,
  AuRedesignFooter,
} from '../src/components/AuRedesignChrome'

export function renderServicePage(path: string) {
  return renderToString(
    <div className="app-shell au-redesign-shell">
      <AuRedesignHeader cartItemCount={0} services />
      {path === '/customer-stories/korea' ? (
        <KoreaCustomerStoriesPage />
      ) : (
        <AuBusinessServicePage slug={path.split('/').at(-1)!} />
      )}
      <AuRedesignFooter />
    </div>,
  )
}
