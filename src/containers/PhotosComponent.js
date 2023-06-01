import React, { useState, useEffect, lazy } from "react"
import { Helmet } from "react-helmet-async"

import ReactGA from "react-ga4"

import "./PhotosComponent.css"
import Button from "react-bootstrap/Button"

const Footer = lazy(() => import("./Footer"))

import {
  Link,
  // NavLink,
  useLocation,
  useParams,
} from "react-router-dom"

// import PropTypes from 'prop-types'
import { gql } from "@apollo/client"
import stringifyObject from "stringify-object"
import NoMatch from "./NoMatch.js"

import * as CONST from "../consts"

const PhotosComponent = function () {
  const [internalState, setInternalState] = useState({
    currPhoto: null,
    nextPhoto: null,
    prevPhoto: null,
    requestComplete: false,
  })

  const [fullSize, setFullSize] = useState(false)
  const { photoId } = useParams()

  useEffect(() => {
    // if (photoId) {
    update({ photoId, fullSize })
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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

  const fetchCurrPhoto = async ({ id, fullSize }) => {
    try {
      const response = (
        await CONST.gqlClient.query({
          query: gql`
            query getPhotoAllCurr($photoId: ID!) {
              getPhotoAllCurr(photoId: $photoId) {
                photo {
                  imgUrl
                  id
                  thumbUrl
                  watchersCount
                }
                comments {
                  comment
                  id
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
        })
      ).data.getPhotoAllCurr

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
      console.log({ err }) // eslint-disable-line
    }
    return null
  }

  const fetchPrevPhoto = async ({ id, fullSize }) => {
    try {
      const response = (
        await CONST.gqlClient.query({
          query: gql`
            query getPhotoAllPrev($photoId: ID!) {
              getPhotoAllPrev(photoId: $photoId) {
                photo {
                  imgUrl
                  id
                  thumbUrl
                  watchersCount
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
        })
      ).data.getPhotoAllPrev

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
      console.log({ err }) // eslint-disable-line
    }

    return null
  }

  const fetchNextPhoto = async ({ id, fullSize }) => {
    try {
      const response = (
        await CONST.gqlClient.query({
          query: gql`
            query getPhotoAllNext($photoId: ID!) {
              getPhotoAllNext(photoId: $photoId) {
                photo {
                  imgUrl
                  id
                  thumbUrl
                  watchersCount
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
        })
      ).data.getPhotoAllNext

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
      console.log({ err }) // eslint-disable-line
    }

    return null
  }

  const update = async ({ photoId, fullSize }) => {
    let id = photoId
    if (!id) {
      const pht = await fetchPrevPhoto({ id: 2147483640 })

      id = pht.photo.id
    }

    ReactGA.send({
      hitType: "pageview",
      page: `/photos/${id}`,
      // title: "Custom Title",
    })

    const currPhotoFn = fetchCurrPhoto({ id, fullSize })
    const nextPhotoFn = fetchNextPhoto({ id, fullSize })
    const prevPhotoFn = fetchPrevPhoto({ id, fullSize })

    const results = await Promise.all([currPhotoFn, nextPhotoFn, prevPhotoFn])

    setInternalState({
      currPhoto: results[0],
      nextPhoto: results[1],
      prevPhoto: results[2],
      requestComplete: true,
    })
  }

  const renderRecognitions = (recognition) => {
    const labels = JSON.parse(recognition.metaData).Labels
    const textDetections = JSON.parse(
      recognition.metaData,
    ).TextDetections.filter((text) => text.Type === "LINE")
    const moderationLabels = JSON.parse(recognition.metaData).ModerationLabels

    return (
      <div>
        {labels.length > 0 && (
          <div style={{ margin: "5px" }}>
            <div style={{ align: "center" }}>
              <h2>
                <b>AI recognized tags:</b>
              </h2>
            </div>
            <span style={{ align: "center" }}>
              {labels.map((label) => (
                <h3 key={label.Name}>
                  <div style={{ fontSize: `${label.Confidence}%` }}>
                    <Link to={`/search/${label.Name}`}>
                      {stringifyObject(label.Name).replace(/'/g, "")}
                    </Link>
                  </div>
                </h3>
              ))}
            </span>
          </div>
        )}

        {textDetections.length > 0 && (
          <div style={{ margin: "5px" }}>
            <div style={{ align: "center" }}>
              <h2>
                <b>AI recognized text:</b>
              </h2>
            </div>
            <span style={{ align: "center" }}>
              {textDetections.map((text) => (
                <h3 key={text.Id}>
                  <div style={{ fontSize: `${text.Confidence}%` }}>
                    {stringifyObject(text.DetectedText).replace(/'/g, "")}
                  </div>
                </h3>
              ))}
            </span>
          </div>
        )}

        {moderationLabels.length > 0 && (
          <div style={{ margin: "5px", paddingBottom: "5px" }}>
            <h2>
              <div style={{ color: "red", align: "center" }}>
                <b>AI moderation tags:</b>
              </div>
            </h2>
            <span style={{ align: "center" }}>
              {moderationLabels.map((label) => (
                <h3 key={label.Name}>
                  <div
                    style={{ fontSize: `${label.Confidence}%`, color: "red" }}
                  >
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </div>
                </h3>
              ))}
            </span>
          </div>
        )}
      </div>
    )
  }

  const renderNavigationButtons = () => {
    const { nextPhoto, prevPhoto } = internalState
    return (
      <div className='lander'>
        {nextPhoto && nextPhoto.photo ? (
          <Link
            to={`/photos/${nextPhoto.photo.id}${
              embedded ? "?embedded=true" : ""
            }`}
            onClick={() => update({ photoId: nextPhoto.photo.id, fullSize })}
          >
            <div style={{ margin: "5px" }} className='button'>
              &lt;&nbsp;next
            </div>
          </Link>
        ) : (
          <div style={{ margin: "5px", color: "#777" }} className='button'>
            &lt;&nbsp;next
          </div>
        )}
        {prevPhoto && prevPhoto.photo ? (
          <Link
            to={`/photos/${prevPhoto.photo.id}${
              embedded ? "?embedded=true" : ""
            }`}
            onClick={() => update({ photoId: prevPhoto.photo.id, fullSize })}
          >
            <div style={{ margin: "5px" }} className='button'>
              prev&nbsp;&gt;
            </div>
          </Link>
        ) : (
          <div style={{ margin: "5px", color: "#777" }} className='button'>
            prev&nbsp;&gt;
          </div>
        )}
      </div>
    )
  }

  const location = useLocation()

  const { currPhoto, requestComplete } = internalState
  const embedded = new URLSearchParams(location.search).get("embedded")

  if (currPhoto && currPhoto?.photo) {
    return (
      <div className='PhotosComponent'>
        {/* <HelmetProvider> */}
        <Helmet prioritizeSeoTags>
          {currPhoto.comments.length > 0 && (
            <title>{`WiSaw: ${currPhoto.comments[0].comment} -- What I Saw`}</title>
          )}
          {currPhoto.comments.length === 0 && (
            <title>{`What I Saw Today photo ${currPhoto.photo.id}`}</title>
          )}
          <meta
            name='description'
            content={
              currPhoto.comments.length > 0
                ? currPhoto.comments[0].comment
                : `wisaw photo ${currPhoto.photo.id}`
            }
          />

          <meta
            property='og:title'
            content={
              currPhoto.comments.length > 0
                ? currPhoto.comments[0].comment
                : `wisaw photo ${currPhoto.photo.id}`
            }
          />
          <meta
            property='og:description'
            content={
              currPhoto.comments.length > 0
                ? currPhoto.comments[0].comment
                : `wisaw photo ${currPhoto.photo.id}`
            }
          />
          <meta
            name='image'
            property='og:image'
            content={`https://s3.amazonaws.com/wisaw-img-prod/${currPhoto.photo.id}-thumb`}
          />
          <meta
            property='og:url'
            content={`https://www.wisaw.com/photos/${currPhoto.photo.id}`}
          />
          <link
            rel='canonical'
            href={`https://www.wisaw.com/photos/${currPhoto.photo.id}`}
          />

          <meta
            name='twitter:title'
            content={
              currPhoto.comments.length > 0
                ? currPhoto.comments[0].comment
                : `wisaw photo ${currPhoto.photo.id}`
            }
          />
          <meta
            name='twitter:card'
            content={`Check out what I saw today:
            ${currPhoto.comments
              .slice(0, 3)
              .map((comment) => comment.comment)
              .join("\n")}`}
          />
          <meta
            name='twitter:description'
            content={
              currPhoto.comments.length > 0
                ? currPhoto.comments[0].comment
                : `wisaw photo ${currPhoto.photo.id}`
            }
          />
          <meta
            name='twitter:image'
            content={`https://s3.amazonaws.com/wisaw-img-prod/${currPhoto.photo.id}-thumb`}
          />
          <meta property='og:type' content='article' />
        </Helmet>
        {/* </HelmetProvider> */}

        {renderNavigationButtons()}

        <div // eslint-disable-line
          className='crop'
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={async () => {
            setFullSize(!fullSize)
            await update({ photoId: currPhoto.photo.id, fullSize: !fullSize })
          }}
        >
          <img
            width={`${currPhoto.width + 100}`}
            height={`${currPhoto.height + 100}`}
            className='mainImage'
            src={
              fullSize
                ? `${currPhoto.photo.imgUrl}`
                : `${currPhoto.photo.thumbUrl}`
            }
            alt={
              currPhoto.comments.length > 0
                ? currPhoto.comments[0].comment
                : `wisaw photo ${currPhoto.photo.id}`
            }
            style={{
              maxHeight: fullSize ? "700px" : "600px",
              maxWidth: fullSize ? "700px" : "600px",
              width: `${currPhoto.width + 100}`,
              height: `${currPhoto.height + 100}`,
            }}
          />
        </div>
        <div style={{ margin: "10px", align: "center" }}>
          <a
            href={`${currPhoto.photo.imgUrl}`}
            target='_blank'
            rel='noreferrer'
          >
            <Button variant='secondary'>Free Download</Button>
          </a>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ margin: "10px", align: "center" }}>
            {currPhoto.comments && currPhoto.comments.length > 0 && (
              <div
                style={{
                  paddingTop: 14,
                  height: 40,
                  width: 40,
                  fontSize: 12,
                  backgroundImage: `url("/comment.webp")`,
                  color: "white",
                }}
              >
                {currPhoto.comments.length}
              </div>
            )}
          </div>
          <div style={{ margin: "10px", align: "center" }}>
            {currPhoto && currPhoto.photo && currPhoto.photo.watchersCount > 0 && (
              <div
                style={{
                  paddingTop: 14,
                  paddingLeft: 10,
                  height: 40,
                  width: 40,
                  fontSize: 12,
                  backgroundImage: `url("/thumbs-up.webp")`,
                  color: "white",
                }}
              >
                {currPhoto.photo.watchersCount}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {currPhoto.comments && (
            <div
              style={{ margin: "10px", paddingBottom: "10px", align: "center" }}
            >
              {currPhoto.comments.map((comment, i) => (
                <div key={comment.id}>
                  {i === 0 && (
                    <h1
                      style={{
                        margin: "10",
                        fontFamily: "Comic Sans MS,Comic Sans,sans-serif",
                      }}
                    >
                      {comment.comment}
                    </h1>
                  )}
                  {i > 0 && (
                    <p
                      style={{
                        margin: "10",
                        fontSize: 24,
                        fontFamily: "Comic Sans MS,Comic Sans,sans-serif",
                      }}
                    >
                      {comment.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {currPhoto.recognitions &&
            renderRecognitions(currPhoto.recognitions[0])}

          <div style={{ margin: "10px", align: "center" }} />
        </div>
        <Footer />
      </div>
    )
  }

  if (requestComplete && (currPhoto === null || currPhoto.photo === null)) {
    return (
      <div className='PhotosComponent'>
        {renderNavigationButtons()}
        <NoMatch />
      </div>
    )
  }

  return <div />
}

export default PhotosComponent
