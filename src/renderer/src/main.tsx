import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { showError } from './lib/errors'
import './index.css'

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault()
  showError(event.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
