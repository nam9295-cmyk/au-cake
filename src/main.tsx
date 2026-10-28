import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/au-renewal.css'
import './styles/au-halloween-meringue.css'
import './styles/au-service-landing.css'
import './styles/renewal-payment-notice.css'
import './styles/au-customer-stories.css'
import './styles/au-business-services.css'
import './styles/au-language.css'
import App from './App.tsx'
import { CartProvider } from './CartProvider'
import { CustomerAccountProvider } from './CustomerAccountProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomerAccountProvider>
      <CartProvider><App /></CartProvider>
    </CustomerAccountProvider>
  </StrictMode>,
)
