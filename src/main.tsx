import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/au-customer-stories.css'
import './styles/au-business-services.css'
import './styles/au-language.css'
import App from './App.tsx'
import { CartProvider } from './CartProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </StrictMode>,
)
