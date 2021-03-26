import React, { useEffect, useState } from 'react'
import ReactGA from 'react-ga'
import { Helmet } from "react-helmet"
import useReactRouter from 'use-react-router'

import "./PhotosComponent.css"

import {
  Link,
} from "react-router-dom"

import PropTypes from 'prop-types'
import NoMatch from "./NoMatch.js"

const stringifyObject = require('stringify-object')
const jmespath = require('jmespath')

const propTypes = {
  match: PropTypes.object.isRequired,
}

const PhotosComponent = props => {
  const [internalState, setInternalState] = useState({
    photo: null,
    nextPhoto: null,
    prevPhoto: null,
    comments: [],
    recognition: null,
    noPhotoFound: false,
  })

  const [fullSize, setFullSize] = useState(false)

  useEffect(() => {
    const { match: { params: { photoId } } } = props
    ReactGA.initialize('UA-3129031-19')
    update({ photoId })
  }, [])// eslint-disable-line

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

  const fetchPhoto = async ({ id }) => {
    const response = await fetch(`https://api.wisaw.com/photos/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const body = await response.json()

    const { photo } = body

    const url = fullSize ? `${photo.getImgUrl}` : `${photo.getThumbUrl}`
    const dimensions = await fetchDimensions({ url })
    return {
      ...photo,
      ...dimensions,
    }
  }

  const fetchPrevPhoto = async ({ id }) => {
    const response = await fetch(`https://api.wisaw.com/photos/prev/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const body = await response.json()
    return (body.photo)
  }

  const fetchNextPhoto = async ({ id }) => {
    const response = await fetch(`https://api.wisaw.com/photos/next/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const body = await response.json()
    return (body.photo)
  }

  const fetchComments = async ({ id }) => {
    const response = await fetch(`https://api.wisaw.com/photos/${id}/comments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const body = await response.json()
    return body.comments.reverse()
  }

  const fetchRecognition = async ({ id }) => {
    const response = await fetch(`https://api.wisaw.com/photos/${id}/recognitions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const body = await response.json()
    return body.recognition
  }
  const update = async ({ photoId }) => {
    // setInternalState(
    //   {
    //     ...internalState,
    //     photo: null,
    //   }
    // )

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

    const photo = fetchPhoto({ id })
    const nextPhoto = fetchNextPhoto({ id })
    const prevPhoto = fetchPrevPhoto({ id })
    const comments = fetchComments({ id })
    const recognition = fetchRecognition({ id })

    const results = await Promise.all([
      photo,
      nextPhoto,
      prevPhoto,
      comments,
      recognition,
    ])

    setInternalState({
      photo: results[0],
      nextPhoto: results[1],
      prevPhoto: results[2],
      comments: results[3],
      recognition: results[4],
      noPhotoFound: !results[0],
    })
    const curr = results[0]
    const next = results[1]
    const prev = results[2]

    if (curr) {
      fetchDimensions({ url: curr.getThumbUrl })
      fetchDimensions({ url: curr.getImgUrl })
    }
    if (next) {
      fetchDimensions({ url: next.getThumbUrl })
      fetchDimensions({ url: next.getImgUrl })
    }
    if (prev) {
      fetchDimensions({ url: prev.getThumbUrl })
      fetchDimensions({ url: prev.getImgUrl })
    }
  }

  const renderRecognitions = recognition => {
    const labels = jmespath.search(recognition, "metaData.Labels[]")
    const textDetections = jmespath.search(recognition, "metaData.TextDetections[?Type=='LINE']")
    const moderationLabels = jmespath.search(recognition, "metaData.ModerationLabels[]")

    return (
      <div style={{ fontFamily: 'Arial' }}>

        {labels.length > 0 && (
          <div style={{ margin: '5px', paddingBottom: '5px' }}>
            <div align="center">
              <h3 style={{ fontWeight: "bold" }}>AI recognized tags:</h3>
            </div>
            <span align="center">
              {labels.map(label => (
                <div key={label.Name} style={{ fontSize: `${label.Confidence}%` }}>{stringifyObject(label.Name).replace(/'/g, '')}</div>
              ))}
            </span>
          </div>
        )}

        {textDetections.length > 0 && (
          <div style={{ margin: '5px', paddingBottom: '5px' }}>
            <div align="center">
              <h3 style={{ fontWeight: "bold" }}>AI recognized text:</h3>
            </div>
            <span align="center">
              {textDetections.map(text => (
                <div key={text.Id} style={{ fontSize: `${text.Confidence}%` }}>{stringifyObject(text.DetectedText).replace(/'/g, '')}</div>
              ))}
            </span>
          </div>
        )}

        {moderationLabels.length > 0 && (
          <div style={{ margin: '5px', paddingBottom: '5px' }}>
            <div align="center" style={{ fontWeight: "bold", color: 'red' }}>
              AI moderation tags:
            </div>
            <span align="center">
              {moderationLabels.map(label => (
                <div key={label.Name} style={{ fontSize: `${label.Confidence}%`, color: 'red' }}>{stringifyObject(label.Name).replace(/'/g, '')}</div>
              ))}
            </span>
          </div>
        )}
      </div>
    )
  }

  const { history, location, match } = useReactRouter()

  const {
    photo,
    nextPhoto,
    prevPhoto,
    comments,
    recognition,
    noPhotoFound,
  } = internalState
  const embedded = new URLSearchParams(location.search).get("embedded")
  if (noPhotoFound) {
    return (
      <NoMatch />
    )
  }

  if (photo) {
    return (
      <div className="PhotosComponent">
        <Helmet>
          {comments.length > 0 && (
            <title>{`WiSaw: ${comments[0].comment}`}</title>
          )}
          {comments.length === 0 && (
            <title>{`What I Saw Today photo ${photo ? photo.id : ''}`}</title>
          )}
          <meta name="description" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />

          <meta property="og:title" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />
          <meta property="og:description" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />
          <meta name="image" property="og:image" content={`https://s3.amazonaws.com/wisaw-img-prod/${photo.id}`} />
          <meta property="og:url" content={`https://www.wisaw.com/photos/${photo.id}`} />
          {photo && (<link rel="canonical" href={`https://www.wisaw.com/photos/${photo.id}`} />)}
        </Helmet>

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
              : <div style={{ margin: '5px' }} className="button">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
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
              : <div style={{ margin: '5px' }} className="button">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
          }
        </div>
        <div // eslint-disable-line
          className="crop"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: `${photo.height}`,
          }}
          onClick={() => {
            setFullSize(!fullSize)
          }}>
          <img
            width={`${photo.width}`}
            height={`${photo.height}`}
            className="mainImage"
            src={fullSize ? `${photo.getImgUrl}` : `${photo.getThumbUrl}`}
            alt={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo.id}`}
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
          <div align="center" style={{ margin: '5px' }}>
            {comments && comments.length > 0 && (
              <div>Comments:{comments.length}</div>
            )}
          </div>
          <div align="center" style={{ margin: '5px' }}>
            {photo && photo.likes > 0 && (
              <div>Likes:{photo.likes}</div>
            )}
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {comments && (
            <div align="center" style={{ margin: '10px', paddingBottom: '20px', fontFamily: 'Courier New' }}>
              {comments.map((comment, i) => (
                <div key={comment.id}>
                  {i === 0 && (
                    <h1
                      style={{ margin: '10', fontFamily: 'Courier New' }}>{comment.comment}
                    </h1>
                  )}
                  {i > 0 && (
                    <p
                      style={{ margin: '10' }}>{comment.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {recognition && renderRecognitions(recognition)}

          <div align="center" style={{ margin: '10px', paddingBottom: '150px' }} />
        </div>
      </div>
    )
  }
  return <div />
}

export default PhotosComponent
