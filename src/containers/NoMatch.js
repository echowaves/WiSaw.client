import React, { lazy } from 'react'

import { useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet'
const Footer = lazy(() => import('./Footer'))

const NoMatch = function () {
  const location = useLocation()
  return (
    <>
      <Helmet>
        <title>404 - Page Not Found | WiSaw</title>
        <meta name='prerender-status-code' content='404' />
        <meta name='description' content='The page you are looking for could not be found. Browse free stock photos and videos on WiSaw.' />
        <meta name='robots' content='noindex, follow' />
        <link rel='canonical' href='https://wisaw.com' />
      </Helmet>
      <div
        style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-primary)' }}
      >
        <h2>No photo found <code style={{ color: 'var(--accent-light)' }}>{location.pathname}</code></h2>
        <Footer />
      </div>
    </>
  )
}

export default NoMatch
