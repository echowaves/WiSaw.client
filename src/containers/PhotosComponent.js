import React, { useState, useEffect } from 'react'
import { Helmet } from "react-helmet"
import useReactRouter from 'use-react-router'
import ReactGA from 'react-ga'

import "./PhotosComponent.css"

import {
  Link,
} from "react-router-dom"

import PropTypes from 'prop-types'
import { gql } from "@apollo/client"
import NoMatch from "./NoMatch.js"

import * as CONST from '../consts'

const stringifyObject = require('stringify-object')
const jmespath = require('jmespath')

const propTypes = {
  match: PropTypes.object.isRequired,
}

const PhotosComponent = props => {
  const [internalState, setInternalState] = useState({
    currPhoto: null,
    nextPhoto: null,
    prevPhoto: null,
    requestComplete: false,
  })

  const [fullSize, setFullSize] = useState(false)
  useEffect(() => {
    const { match: { params: { photoId } } } = props

    update({ photoId })
  }, [])// eslint-di
  /**
this methid will fetch image into cache -- will work super fast on next call to the same url
*/
  const fetchDimensions = async ({ url }) => {
    const img = new Image()
    img.src = url
    await img.decode()
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
    }
  }

  const fetchCurrPhoto = async ({ id }) => {
    try {
      const response = (await CONST.gqlClient
        .query({
          query: gql`
                      query getPhotoAllCurr($photoId: ID!) {
                        getPhotoAllCurr(photoId: $photoId) {
                          photo {
                            imgUrl
                            id
                            thumbUrl
                            likes
                          }
                          comments {
                            comment
                          }
                          recognitions {
                            metaData
                          }
                        }
                      }
                    `,
          variables: {
            photoId: id,
          },
        })).data.getPhotoAllCurr

      const { photo } = response

      if (photo) {
        const url = fullSize ? `${photo.imgUrl}` : `${photo.thumbUrl}`
        const dimensions = await fetchDimensions({ url })
        return {
          ...response,
          ...dimensions,
        }
      }
    } catch (err) {
      console.log({ err })// eslint-disable-line
    }
    return null
  }

  const fetchPrevPhoto = async ({ id }) => {
    try {
      const response = await fetch(`https://api.wisaw.com/photos/prev/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json()
      return (body.photo)
    } catch (error) {
      console.log({ error })
    }
    return null
  }

  const fetchNextPhoto = async ({ id }) => {
    try {
      const response = await fetch(`https://api.wisaw.com/photos/next/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json()
      return (body.photo)
    } catch (error) {
      console.log({ error })
    }
    return null
  }

  const update = async ({ photoId }) => {
    let id = photoId
    if (!id) {
      const response = await fetch(`https://api.wisaw.com/photos/prev/2147483640`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()
      id = body.photo.id
    }

    ReactGA.pageview(`/photos/${id}`)

    const currPhoto = fetchCurrPhoto({ id })
    const nextPhoto = fetchNextPhoto({ id })
    const prevPhoto = fetchPrevPhoto({ id })

    const results = await Promise.all([
      currPhoto,
      nextPhoto,
      prevPhoto,
    ])

    setInternalState({
      currPhoto: results[0],
      nextPhoto: results[1],
      prevPhoto: results[2],
      requestComplete: true,
    })
    // const curr = results[0]
    const next = results[1]
    const prev = results[2]

    if (next) {
      fetchDimensions({ url: fullSize ? next.getImgUrl : next.getThumbUrl })
    }
    if (prev) {
      fetchDimensions({ url: fullSize ? prev.getImgUrl : prev.getThumbUrl })
    }
  }

  const renderRecognitions = recognition => {
    const labels = jmespath.search(recognition, "metaData.Labels[]")
    const textDetections = jmespath.search(recognition, "metaData.TextDetections[?Type=='LINE']")
    const moderationLabels = jmespath.search(recognition, "metaData.ModerationLabels[]")

    return (
      <div>
        {labels.length > 0 && (
          <div style={{ margin: '5px' }}>
            <div align="center">
              <h2><b>AI recognized tags:</b></h2>
            </div>
            <span align="center">
              {labels.map(label => (
                <h3>
                  <div key={label.Name} style={{ fontSize: `${label.Confidence}%` }}>
                    <Link
                      to={`/search/${label.Name}`}>
                      {
                        stringifyObject(label.Name).replace(/'/g, '')
                      }
                    </Link>

                  </div>
                </h3>
              ))}
            </span>
          </div>
        )}

        {textDetections.length > 0 && (
          <div style={{ margin: '5px' }}>
            <div align="center">
              <h2><b>AI recognized text:</b></h2>
            </div>
            <span align="center">
              {textDetections.map(text => (
                <h3><div key={text.Id} style={{ fontSize: `${text.Confidence}%` }}>{stringifyObject(text.DetectedText).replace(/'/g, '')}</div></h3>
              ))}
            </span>
          </div>
        )}

        {moderationLabels.length > 0 && (
          <div style={{ margin: '5px', paddingBottom: '5px' }}>
            <h2>
              <div align="center" style={{ color: 'red' }}>
                <b>AI moderation tags:</b>
              </div>
            </h2>
            <span align="center">
              {moderationLabels.map(label => (
                <h3><div key={label.Name} style={{ fontSize: `${label.Confidence}%`, color: 'red' }}>{stringifyObject(label.Name).replace(/'/g, '')}</div></h3>
              ))}
            </span>
          </div>
        )}
      </div>
    )
  }

  const renderNavigationButtons = () => {
    const {
      nextPhoto,
      prevPhoto,
    } = internalState
    return (
      <div className="lander">
        {
          nextPhoto
            ? (

              <Link
                to={`/photos/${nextPhoto.id}${embedded ? '?embedded=true' : ''}`}
                onClick={() => update({ photoId: nextPhoto.id })}>
                <div style={{ margin: '5px' }} className="button">
                  &lt;&nbsp;next
                </div>
              </Link>
            )
            : (
              <div style={{ margin: '5px', color: '#777' }} className="button">
                &lt;&nbsp;next
              </div>
            )
        }
        {
          prevPhoto
            ? (
              <Link
                to={`/photos/${prevPhoto.id}${embedded ? '?embedded=true' : ''}`}
                onClick={() => update({ photoId: prevPhoto.id })}>
                <div style={{ margin: '5px' }} className="button">
                  prev&nbsp;&gt;
                </div>
              </Link>
            )
            : (
              <div style={{ margin: '5px', color: '#777' }} className="button">
                prev&nbsp;&gt;
              </div>
            )
        }
      </div>
    )
  }

  const { history, location, match } = useReactRouter()

  const { match: { params: { photoId } } } = props

  const {
    currPhoto,
    requestComplete,
  } = internalState
  const embedded = new URLSearchParams(location.search).get("embedded")

  if (currPhoto?.photo) {
    return (
      <div className="PhotosComponent">
        <Helmet>
          {currPhoto.comments.length > 0 && (
            <title>{`WiSaw: ${currPhoto.comments[0].comment} -- What I Saw`}</title>
          )}
          {currPhoto.comments.length === 0 && (
            <title>{`What I Saw Today photo ${currPhoto.photo.id}`}</title>
          )}
          <meta name="description" content={currPhoto.comments.length > 0 ? currPhoto.comments[0].comment : `wisaw photo ${currPhoto.photo.id}`} />

          <meta property="og:title" content={currPhoto.comments.length > 0 ? currPhoto.comments[0].comment : `wisaw photo ${currPhoto.photo.id}`} />
          <meta property="og:description" content={currPhoto.comments.length > 0 ? currPhoto.comments[0].comment : `wisaw photo ${currPhoto.photo.id}`} />
          <meta name="image" property="og:image" content={`https://s3.amazonaws.com/wisaw-img-prod/${currPhoto.photo.id}`} />
          <meta property="og:url" content={`https://www.wisaw.com/photos/${currPhoto.photo.id}`} />
          <link rel="canonical" href={`https://www.wisaw.com/photos/${currPhoto.photo.id}`} />

          <meta name="twitter:title" content={currPhoto.comments.length > 0 ? currPhoto.comments[0].comment : `wisaw photo ${currPhoto.photo.id}`} />
          <meta
            name="twitter:card" content={`Check out what I saw today:
            ${currPhoto.comments.slice(0, 3).map(comment => comment.comment).join('\n')}`}
          />
          <meta name="twitter:description" content={currPhoto.comments.length > 0 ? currPhoto.comments[0].comment : `wisaw photo ${currPhoto.photo.id}`} />
          <meta name="twitter:image" content={`https://s3.amazonaws.com/wisaw-img-prod/${currPhoto.photo.id}`} />
        </Helmet>

        {renderNavigationButtons()}

        <div // eslint-disable-line
          className="crop"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={async () => {
            await setFullSize(!fullSize)
            await update({ photoId: currPhoto.photo.id })
          }}>
          <img
            width={`${currPhoto.width}`}
            height={`${currPhoto.height}`}
            className="mainImage"
            src={fullSize ? `${currPhoto.photo.imgUrl}` : `${currPhoto.photo.thumbUrl}`}
            alt={currPhoto.comments.length > 0 ? currPhoto.comments[0].comment : `wisaw photo ${currPhoto.photo.id}`}
            style={{
              maxHeight: fullSize ? '600px' : '300px',
              maxWidth: fullSize ? '600px' : '300px',
              width: 'auto',
              height: 'auto',
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div align="center" style={{ margin: '10px' }}>
            {currPhoto.comments && currPhoto.comments.length > 0 && (
              <div style={{
                paddingTop: 14,
                height: 40,
                width: 40,
                fontSize: 12,
                backgroundImage: `url("/comment.webp")`,
                color: 'white',
              }}>{currPhoto.comments.length}
              </div>
            )}
          </div>
          <div align="center" style={{ margin: '10px' }}>
            {currPhoto.photo && currPhoto.photo.likes > 0 && (
              <div style={{
                paddingTop: 14,
                paddingLeft: 10,
                height: 40,
                width: 40,
                fontSize: 12,
                backgroundImage: `url("/thumbs-up.webp")`,
                color: 'white',
              }}>{currPhoto.photo.likes}
              </div>
            )}
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {currPhoto.comments && (
            <div align="center" style={{ margin: '10px', paddingBottom: '10px' }}>
              {currPhoto.comments.map((comment, i) => (
                <div key={comment.id}>
                  {i === 0 && (
                    <h1
                      style={{ margin: '10', fontFamily: 'Comic Sans MS,Comic Sans,sans-serif' }}>{comment.comment}
                    </h1>
                  )}
                  {i > 0 && (
                    <p
                      style={{ margin: '10', fontSize: 24, fontFamily: 'Comic Sans MS,Comic Sans,sans-serif' }}>{comment.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {currPhoto.recognition && renderRecognitions(currPhoto.recognition)}

          <div align="center" style={{ margin: '10px', paddingBottom: '150px' }} />
        </div>
      </div>
    )
  }

  if (requestComplete && currPhoto.photo === null) {
    return (
      <div className="PhotosComponent">
        {renderNavigationButtons()}
        <NoMatch />
      </div>
    )
  }

  return <div />
}

export default PhotosComponent
