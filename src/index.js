import 'bootstrap/dist/css/bootstrap.css'
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import './index.css'
import reportWebVitals from './reportWebVitals'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister()
      })
    })
    .catch(() => { })
}

const root = ReactDOM.createRoot(document.getElementById('root'))
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
