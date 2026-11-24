import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/au-renewal.css'
import './styles/au-halloween-meringue.css'
import './styles/au-service-landing.css'
import './styles/renewal-payment-notice.css'
import './styles/au-customer-stories.css'
import './styles/au-business-services.css'
import './styles/au-language.css'
import './styles/au-related-reading.css'
import App from './App.tsx'
import { CartProvider } from './CartProvider'
import { CustomerAccountProvider } from './CustomerAccountProvider'

const container = document.getElementById('root')!
function mount(catalogApp?: ReactElement) {
  createRoot(container).render(
    <StrictMode>
      <CustomerAccountProvider>
        <CartProvider>{catalogApp ?? <App />}</CartProvider>
      </CustomerAccountProvider>
    </StrictMode>,
  )
}

const catalogLink = document.querySelector<HTMLLinkElement>('link[data-au-catalog]')
if (container.firstElementChild && catalogLink) {
  // Keep the server-rendered product information readable until its controls are available.
  void import('./pages/AuRenewalCatalog').then(
    ({ default: Catalog }) => mount(<App Catalog={Catalog} />),
    () => {
      const retry = document.createElement('button')
      retry.type = 'button'
      retry.textContent = 'Page controls could not load. Try again'
      retry.addEventListener('click', () => {
        retry.disabled = true
        // Refresh the failed preload before a manual reload. WebKit can otherwise reuse the failure.
        void fetch(catalogLink.href, { cache: 'reload' }).then(
          () => window.location.reload(),
          () => { retry.disabled = false },
        )
      })
      container.querySelector('h1')?.after(retry)
    },
  )
} else {
  mount()
}
