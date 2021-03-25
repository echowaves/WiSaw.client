import React from "react"
import useReactRouter from 'use-react-router'

import NestedStatus from 'react-nested-status'

const NoMatch = () => {
  const { history, location, match } = useReactRouter()
  return (
    <NestedStatus code={404}>
      <div>
        <h2>No match found for <code>{location.pathname}</code></h2>
      </div>
    </NestedStatus>
  )
}

export default NoMatch
