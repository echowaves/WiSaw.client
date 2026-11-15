import 'bootstrap/dist/css/bootstrap.css'
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import './index.css'
import reportWebVitals from './reportWebVitals'
import { captureDetailSkeleton, getDetailSkeleton } from './utils/detailSkeleton'

// Signals the inline guard in index.html that this bundle actually loaded and ran.
window.__wisawBooted = true

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister()
      })
    })
    .catch(() => { })
}

// On detail routes Lambda@Edge serves a complete static page inside #root. Capture it before the
// first commit so React can mount into a sibling container and enhance that untouched markup via
// portals - if React reconciled #root itself, detaching the server-painted media node at commit
// time would re-date its LCP paint to JS-delivery time, which is the failure this removes.
captureDetailSkeleton()
const rootElement = document.getElementById('root')
if (getDetailSkeleton() == null && rootElement) {
  // No skeleton (non-detail route, or an old edge still cached): #root holds the shell's static
  // h1/h2 fallback, which would duplicate the React page, so clear it exactly as today's
  // createRoot(#root).render() did. Guarded: a served page missing the mount point must still
  // boot the app rather than die on a null dereference.
  rootElement.innerHTML = ''
}

const appElement = document.getElementById('wisaw-app') ?? (() => {
  const element = document.createElement('div')
  element.id = 'wisaw-app'
  document.body.appendChild(element)
  return element
})()
const root = ReactDOM.createRoot(appElement)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Send Core Web Vitals to Google Analytics 4
reportWebVitals(({ name, delta, id }) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, {
      event_category: 'Web Vitals',
      value: Math.round(name === 'CLS' ? delta * 1000 : delta),
      event_label: id,
      non_interaction: true
    })
  }
})
