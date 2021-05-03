import React, { useEffect, useState } from 'react'
import { Helmet } from "react-helmet"
import "react-loader-spinner/dist/loader/css/react-spinner-loader.css"
import Loader from "react-loader-spinner"

import { GridList, GridListTile } from '@material-ui/core'

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
    update({ searchString })
  }, [])// eslint-disable-line

  const update = async ({ searchString }) => {
    try {
      if (searchString) {
        const response = await fetch(`https://api.wisaw.com/photos/feedForTextSearch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uuid: 'web_search_UUID',
            searchTerm: searchString,
            pageNumber: 0,
            batch: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), // batch id random
          }),
        })

        const responseJson = await response.json()

        setInternalState({
          photos: responseJson.photos,
          requestComplete: true,
        })
      }
    } catch (error) {
      console.log({ error })
    }
    console.log('done')
  }

  const { match: { params: { searchString } } } = props

  const {
    photos,
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
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <GridList
            className="classes.gridList" cellHeight="auto" cols="auto"
            style={{
              justifyContent: 'center',
            }}>
            {photos.map(tile => (
              <GridListTile key={tile.id}>
                <Link
                  to={`/photos/${tile.id}`}>
                  <img src={tile.getThumbUrl} alt={tile.getThumbUrl} />
                </Link>

              </GridListTile>
            ))}
          </GridList>
        </div>
        <div>&nbsp;</div>
        <div>&nbsp;</div>
        <div>&nbsp;</div>
        <div>&nbsp;</div>
        <div>&nbsp;</div>
        <div>&nbsp;</div>
      </div>
    )
  }

  return (
    <div className="PhotosComponent">
      <div // eslint-disable-line
        className="crop"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Loader
          type="Grid"
          color="#00BFFF"
          height={100}
          width={100}
          timeout={60000}
        />
      </div>
    </div>
  )
}

export default SearchComponent
