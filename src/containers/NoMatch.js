import React from "react"
import useReactRouter from 'use-react-router'

import NestedStatus from 'react-nested-status'

const NoMatch = () => {
  const { history, location, match } = useReactRouter()
  return (
    <NestedStatus code={404}>
      <div align="center">
        <h2>No photo found <code>{location.pathname}</code></h2>
      </div>
    </NestedStatus>
  )
}

export default NoMatch
