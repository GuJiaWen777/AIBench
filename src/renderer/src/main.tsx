import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import QuickSearch from './views/QuickSearch'
import { showError } from './lib/errors'
import './index.css'

const isQuickWindow = new URLSearchParams(window.location.search).get('quick') === '1'
if (isQuickWindow) {
  document.documentElement.classList.add('quick')
  document.body.classList.add('quick-body')
}

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault()
  showError(event.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isQuickWindow ? <QuickSearch /> : <App />}</StrictMode>
)
