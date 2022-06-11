import React, { useEffect, useState } from 'react'
import { Helmet } from "react-helmet-async"
import "react-loader-spinner/dist/loader/css/react-spinner-loader.css"
import Loader from "react-loader-spinner"

import "./PhotosComponent.css"

import { ImageList, ImageListItem } from '@material-ui/core'

import {
  Link,
  useParams,
} from "react-router-dom"

import PropTypes from 'prop-types'
import { gql } from "@apollo/client"
// import stringifyObject from 'stringify-object'
import * as CONST from '../consts'

const SearchComponent = () => {
  const { searchString } = useParams()

  const [internalState, setInternalState] = useState({
    photos: [],
    requestComplete: false,
  })

  useEffect(() => {
    if (searchString) { update({ searchString }) }
  }, [])// eslint-disable-line

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
            query feedForTextSearch($searchTerm: String!, $pageNumber: Int!, $batch: String!) {
              feedForTextSearch(searchTerm: $searchTerm, pageNumber: $pageNumber, batch: $batch){
                photos {
                        id
                        imgUrl
                        thumbUrl
                        commentsCount
                        watchersCount
                        lastComment
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
        <Helmet prioritizeSeoTags>
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
          // className="crop"
          style={{
            // display: 'flex',
            // justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ImageList
            cols={1}
            gap={10}>
            {photos.map(tile => (
              <div
                key={tile.id}
                className="crop"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <ImageListItem
                // className="crop"
                  style={{
                  // display: 'flex',
                  // justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  key={tile.id}>
                  <Link
                    to={`/photos/${tile.id}`}
                    // className="crop"
                    style={{
                    // display: 'flex',
                    // justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <img
                      style={{
                        alignItems: 'center',
                        maxHeight: '300px',
                        maxWidth: '300px',
                        width: 'auto',
                        height: 'auto',
                      }}
                      src={tile.thumbUrl}
                      width="99%"
                      alt={tile.lastComment}
                    />
                  </Link>
                  <div
                    style={{
                      padding: 10,
                      marginBottom: 10,
                      lineHeight: "1.2em",
                      height: "auto",
                      textAlign: 'center',
                    }}>
                    {tile.lastComment}
                  </div>
                </ImageListItem>
              </div>
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

export default SearchComponent
