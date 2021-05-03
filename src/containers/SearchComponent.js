import React, { useEffect, useState } from 'react'
import ReactGA from 'react-ga'
import { Helmet } from "react-helmet"
import useReactRouter from 'use-react-router'

import {
  Link,
} from "react-router-dom"

import PropTypes from 'prop-types'

const stringifyObject = require('stringify-object')

const propTypes = {
  match: PropTypes.object.isRequired,
}

const SearchComponent = props => {
  const [internalState, setInternalState] = useState({
    photos: [],
    requestComplete: false,
  })

  useEffect(() => {
    const { match: { params: { searchString } } } = props
    ReactGA.initialize('UA-3129031-19')
    update({ searchString })
  }, [])// eslint-disable-line

  const update = async ({ searchString }) => {
    if (searchString) {
      const response = await fetch(`https://api.wisaw.com/photos/prev/2147483640`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()
    }

    setInternalState({
      photos: [],
      requestComplete: true,
    })
  }

  const { history, location, match } = useReactRouter()

  const { match: { params: { searchString } } } = props

  const {
    photo,
    comments,
    recognition,
    requestComplete,
  } = internalState

  if (requestComplete) {
    return (
      <div className="PhotosComponent">
        <Helmet>
          <title>{`WiSaw: searching for ${searchString}`}</title>

          <meta name="description" content={`WiSaw: searching for ${searchString}`} />

          <meta property="og:title" content={`WiSaw: searching for ${searchString}`} />
          <meta property="og:description" content={`WiSaw: searching for ${searchString}`} />
          <meta name="image" property="og:image" content="" />
          <meta
            property="og:url" content={`https://www.wisaw.com/search/${searchString}`}
          />
          <link rel="canonical" href={`https://www.wisaw.com/search/${searchString}`} />

          <meta name="twitter:title" content={`WiSaw: searching for ${searchString}`} />
          <meta
            name="twitter:card" content={`WiSaw: searching for ${searchString}`}
          />
          <meta name="twitter:description" content={`WiSaw: searching for ${searchString}`} />
          <meta name="twitter:image" content="" />
        </Helmet>

        <div // eslint-disable-line
          className="crop"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
        </div>
      </div>
    )
  }

  return <div />
}

export default SearchComponent
