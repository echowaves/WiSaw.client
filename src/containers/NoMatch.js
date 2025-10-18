import React, { lazy } from 'react'

import { useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
const Footer = lazy(() => import('./Footer'))

const NoMatch = function () {
  const location = useLocation()
  return (
    <>
      <Helmet>
        <title>404 - Page Not Found</title>
        <meta name='prerender-status-code' content='404' />
      </Helmet>
      <div
        style={{ align: 'center' }}
      >
        <h2>No photo found <code>{location.pathname}</code></h2>
        <Footer />
      </div>
    </>
  )
}

export default NoMatch
