import 'bootstrap/dist/css/bootstrap.css'
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import './index.css'
import reportWebVitals from './reportWebVitals'
import { captureDetailSkeleton, getDetailSkeleton } from './utils/detailSkeleton'
import { STATIC_FRAME_ATTRIBUTE } from './utils/staticFrame'

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
if (getDetailSkeleton() == null && rootElement?.firstElementChild) {
  // No skeleton (non-detail route, or an old edge still cached): #root holds the shell's own first
  // frame - chrome, headings and a reserved feed area that already match this app. Clearing it here
  // would blank the page the visitor is looking at and show "Loading..." in its place until the lazy
  // route chunk lands, so the frame stays and App.js hands it back instead: it removes the node in
  // the commit where Header and route content appear (see utils/staticFrame.js). Marking
  // whatever is inside covers a cached older template's fallback too. Guarded on both counts: a page
  // with no mount point must still boot, and an empty one has nothing to hand back - that case keeps
  // the normal "Loading..." fallback rather than sitting on a transparent shell over nothing.
  rootElement.setAttribute(STATIC_FRAME_ATTRIBUTE, '')
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
