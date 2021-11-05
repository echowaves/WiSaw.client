import React, { useEffect, useState } from 'react'
import { Helmet } from "react-helmet"
import "react-loader-spinner/dist/loader/css/react-spinner-loader.css"
import Loader from "react-loader-spinner"

import { ImageList, ImageListItem } from '@material-ui/core'

import {
  Link,
} from "react-router-dom"

import PropTypes from 'prop-types'
import { gql } from "@apollo/client"
// import stringifyObject from 'stringify-object'
import * as CONST from '../consts'

const SearchComponent = props => {
  const [internalState, setInternalState] = useState({
    photos: [],
    requestComplete: false,
  })

  useEffect(() => {
    const { match: { params: { searchString } } } = props
    update({ searchString })
  }, [])// eslint-disable-line

  const { match: { params: { searchString } } } = props

  const {
    photos,
    requestComplete,
  } = internalState

  const update = async ({ searchString }) => {
    if (searchString) {
      try {
        const response = (await CONST.gqlClient
          .query({
            query: gql`
            query feedForTextSearch($searchTerm: String!, $pageNumber: Int!, $batch: Long!) {
              feedForTextSearch(searchTerm: $searchTerm, pageNumber: $pageNumber, batch: $batch){
                photos {
                        id
                        imgUrl
                        thumbUrl
                        commentsCount
                        watchersCount
                      }
                batch,
                noMoreData
              }
            }`,
            variables: {
              searchTerm: searchString,
              batch: 123123,
              pageNumber: 0,
            },
          }))
        // console.log({ response })
        setInternalState({
          photos: response.data.feedForTextSearch.photos,
          requestComplete: true,
        })
      } catch (err) {
          console.log({ err })// eslint-disable-line
      }
      // console.log('done')
    }
  }

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
          <ImageList
            cols={1}
            gap={10}>
            {photos.map(tile => (
              <ImageListItem
                key={tile.id}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Link
                  to={`/photos/${tile.id}`}>
                  <img
                    src={tile.thumbUrl} alt={tile.thumbUrl}
                    width="99%"
                    // height={`${tile.height}`}
                  />
                </Link>
              </ImageListItem>
            ))}
          </ImageList>
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

SearchComponent.propTypes = {
  match: PropTypes.object.isRequired,
}

export default SearchComponent
