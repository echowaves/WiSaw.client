import React, { lazy } from "react";
const Footer = lazy(() => import("./Footer"))

import { useLocation } from "react-router-dom"

import NestedStatus from 'react-nested-status'

const NoMatch = function () {
  const location = useLocation()
  return (
    <NestedStatus code={404}>
      <div 
        style={{align: "center"}}
      >
        <h2>No photo found <code>{location.pathname}</code></h2>
        <Footer />
      </div>
    </NestedStatus>
  )
}

export default NoMatch
