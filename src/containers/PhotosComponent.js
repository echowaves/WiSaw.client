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
  const [photo, setPhoto] = useState(null)
  const [comments, setComments] = useState([])
  const [recognition, setRecognition] = useState(null)
  const [nextPhoto, setNextPhoto] = useState(null)
  const [prevPhoto, setPrevPhoto] = useState(null)
  const [noPhotoFound, setNoPhotoFound] = useState(false)
  const [fullSize, setFullSize] = useState(false)

  useEffect(() => {
    let { match: { params: { photoId } } } = props
    if (!photoId) {
      fetch(`https://api.wisaw.com/photos/prev/${2147483640}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(response => {
          if (response.ok) {
            return response.json()
          }
          throw new Error('Something went wrong ...')
        })
        .then(body => {
          photoId = body.photo.id
          ReactGA.initialize('UA-3129031-19')
          update(photoId)
        })
        .catch(error =>	console.log(JSON.stringify(error))) // eslint-disable-line no-console
    } else {
      ReactGA.initialize('UA-3129031-19')
      update(photoId)
    }
  }, [])// eslint-disable-line

  const update = async photoId => {
    ReactGA.pageview(`/photos/${photoId}`)
    setPhoto(null)

    try {
      const response = await fetch(`https://api.wisaw.com/photos/${photoId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const body = await response.json()
      if (body) {
        setPhoto(body.photo)
        setNoPhotoFound(false)
      }
    } catch (error)	{
      setPhoto(null)
      setNoPhotoFound(true)
    }

    fetch(`https://api.wisaw.com/photos/prev/${photoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (response.ok) {
          return response.json()
        }
        throw new Error('Something went wrong ...')
      })
      .then(body => {
        setPrevPhoto(body.photo)
      })
      .catch(error => setPrevPhoto(null))

    fetch(`https://api.wisaw.com/photos/next/${photoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (response.ok) {
          return response.json()
        }
        throw new Error('Something went wrong ...')
      })
      .then(body => {
        setNextPhoto(body.photo)
      })
      .catch(error => setNextPhoto(null))

    fetch(`https://api.wisaw.com/photos/${photoId}/comments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (response.ok) {
          return response.json()
        }
        throw new Error('Something went wrong ...')
      })
      .then(body => {
        setComments(body.comments.reverse())
      })
      .catch(error => setPhoto(null))

    fetch(`https://api.wisaw.com/photos/${photoId}/recognitions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (response.ok) {
          return response.json()
        }
        throw new Error('Something went wrong ...')
      })
      .then(body => {
        setRecognition(body.recognition)
      })
      .catch(error => setRecognition(null))
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

  const embedded = new URLSearchParams(location.search).get("embedded")
  if (noPhotoFound) {
    return (
      <NoMatch />
    )
  }

  return (
    <div className="PhotosComponent">
      {photo && (
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
      )}

      <div className="lander">
        {
          nextPhoto
            ? (

              <Link
                to={`/photos/${nextPhoto.id}${embedded ? '?embedded=true' : ''}`}
                onClick={() => update(nextPhoto.id)}>
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
                onClick={() => update(prevPhoto.id)}>
                <div style={{ margin: '5px' }} className="button">
                  prev&nbsp;&gt;
                </div>
              </Link>
            )
            : <div style={{ margin: '5px' }} className="button">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
        }
      </div>
      <div
        className="crop"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: fullSize ? '600px' : '300px',
        }}>
        {photo && (
        // eslint-disable-next-line
						<img
            width="1"
            height="1"
            className="mainImage" src={fullSize ? `${photo.getImgUrl}` : `${photo.getThumbUrl}`}
            alt={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo.id}`}
            onClick={() => {
              setFullSize(!fullSize)
            }}
            style={{
              maxHeight: fullSize ? '600px' : '300px',
              maxWidth: fullSize ? '600px' : '300px',
              width: 'auto',
              height: 'auto',
            }}
            // eslint-disable-next-line
          />
        )}
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

export default PhotosComponent
