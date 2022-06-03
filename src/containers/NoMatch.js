import React from "react"
import { useLocation } from "react-router-dom"

import NestedStatus from 'react-nested-status'

const NoMatch = () => {
  const location = useLocation()
  return (
    <NestedStatus code={404}>
      <div align="center">
        <h2>No photo found <code>{location.pathname}</code></h2>
      </div>
    </NestedStatus>
  )
}

export default NoMatch
