import React, { lazy, useEffect, useState } from "react"
import ReactPlayer from 'react-player'

import { Helmet } from "react-helmet-async"

import ReactGA from "react-ga4"

import Button from "react-bootstrap/Button"


import "./PhotosComponent.css"

const Footer = lazy(() => import("./Footer"))

import {
  Link,
  // NavLink,
  useLocation,
  useParams
} from "react-router-dom"

// import PropTypes from 'prop-types'
import { gql } from "@apollo/client"
import stringifyObject from "stringify-object"
import NoMatch from "./NoMatch.js"

import * as CONST from "../consts"

const PhotosComponent = function () {
  const screenWidth = window.innerWidth

  const [internalState, setInternalState] = useState({
    currPhoto: null,
    nextPhoto: null,
    prevPhoto: null,
    requestComplete: false,
  })

  const [dimensions, setDimensions] = useState({width: null, height: null})

  const { photoId } = useParams()

  useEffect(() => {
    if (photoId) {
      load({ photoId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if(internalState.requestComplete) {
      ReactGA.send({
        hitType: "pageview",
        page: internalState?.currPhoto?.photo?.video === true ? 
        `/videos/${internalState?.currPhoto?.photo?.id}` : `/photos/${internalState?.currPhoto?.photo?.id}` ,
        // title: "Custom Title",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalState])

  /**
this methid will fetch image into cache -- will work super fast on next call to the same url
*/
  const fetchDimensions = async ({photoId}) => {
    const img = new Image()
    img.src = `https://img.wisaw.com/${photoId}-thumb`
    await img.decode()

    const maxDimention = screenWidth < 700 ? 300 : 700
    const {naturalWidth,  naturalHeight} = img

    setDimensions({
      width: naturalWidth > naturalHeight ?  maxDimention : maxDimention * naturalWidth / naturalHeight, //img.naturalWidth,
      height: naturalWidth < naturalHeight ? maxDimention: maxDimention * naturalHeight  / naturalWidth, //img.naturalHeight,
    })
  }

  const fetchCurrPhoto = async ({ photoId }) => {
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
                  video
                  videoUrl
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
            photoId,
          },
        })
      ).data.getPhotoAllCurr

      const { photo } = response
      if (photo) {
        return {
          ...response,
        }
      }
    } catch (err) {
      console.log({ err }) // eslint-disable-line
    }
    return null
  }

  const fetchPrevPhoto = async ({ photoId }) => {
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
                  video
                  videoUrl
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
            photoId,
          },
        })
      ).data.getPhotoAllPrev

      const { photo } = response

      if (photo) {
        return {
          ...response,
        }
      }
    } catch (err) {
      console.log({ err }) // eslint-disable-line
    }

    return null
  }

  const fetchNextPhoto = async ({ photoId }) => {
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
                  video
                  videoUrl
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
            photoId,
          },
        })
      ).data.getPhotoAllNext

      const { photo } = response

      if (photo) {
        return {
          ...response,
        }
      }
    } catch (err) {
      console.log({ err }) // eslint-disable-line
    }

    return null
  }

  const load = async ({ photoId }) => {

    const results = await Promise.all([
      fetchCurrPhoto({ photoId }), 
      fetchNextPhoto({ photoId }), 
      fetchPrevPhoto({ photoId })
    ])

    if(results[0]) await fetchDimensions({photoId: results[0]?.photo?.id})

    setInternalState({
      currPhoto: results[0],
      nextPhoto: results[1],
      prevPhoto: results[2],
      requestComplete: true,
    })
  }

  const loadNext = async () => {
    setInternalState({
      currPhoto: null,
      nextPhoto: null,
      prevPhoto: null,
      requestComplete: false
    })
    const nextPhoto = await fetchNextPhoto({ photoId: internalState.nextPhoto.photo.id })

    await fetchDimensions({photoId: internalState.nextPhoto.photo.id})

    setInternalState({            
      prevPhoto: internalState.currPhoto,
      currPhoto: internalState.nextPhoto,
      nextPhoto,
      requestComplete: true,
    })
  }

  const loadPrev = async () => {
    setInternalState({
      currPhoto: null,
      nextPhoto: null,
      prevPhoto: null,
      requestComplete: false
    })

    const prevPhoto = await fetchPrevPhoto({ photoId: internalState.prevPhoto.photo.id })
    
    await fetchDimensions({photoId: internalState.prevPhoto.photo.id })

    setInternalState({      
      nextPhoto: internalState.currPhoto,
      currPhoto: internalState.prevPhoto,
      prevPhoto: prevPhoto,
      requestComplete: true,
    })
  }


  const recognitionsLabels = (recognition) => {    
    if(!recognition) return ''
    return JSON.parse(recognition.metaData)?.Labels?.slice(0, 3).map((label) => label.Name).join(", ")
  }

  const renderRecognitions = (recognition) => {    
    if(!recognition) return(<div/>)
    const labels = JSON.parse(recognition?.metaData)?.Labels
    const textDetections = JSON.parse(
      recognition.metaData,
    ).TextDetections?.filter((text) => text?.Type === "LINE")
    const moderationLabels = JSON.parse(recognition?.metaData)?.ModerationLabels


    return (
      <div>
        {labels?.length > 0 && (
          <div style={{ margin: "5px" }}>
            <div style={{ align: "center" }}>
              <h2>
                <b>AI recognized tags:</b>
              </h2>
            </div>
            <span style={{ align: "center" }}>
              {labels.map((label) => (
                <h3 key={label.Name}>
                  <div style={{ fontSize: `${label?.Confidence}%` }}>
                    <Link to={`/search/${label.Name}`}>
                      {stringifyObject(label.Name).replace(/'/g, "")}
                    </Link>
                  </div>
                </h3>
              ))}
            </span>
          </div>
        )}

        {textDetections?.length > 0 && (
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

        {moderationLabels?.length > 0 && (
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
    // const { nextPhoto, prevPhoto } = internalState
    return (
      <div className='lander'>      
        {internalState?.prevPhoto && internalState?.prevPhoto?.photo ? (
          <Link
            to={`/${internalState?.prevPhoto?.photo?.video === true ? 'videos': 'photos'}/${internalState?.prevPhoto?.photo?.id}${
              embedded ? "?embedded=true" : ""
            }`}
            onClick={async() =>  await loadPrev()}
          >
            <div style={{ margin: "5px" }} className='button'>
            &lt;&nbsp;prev
            </div>
          </Link>
        ) : (
          <div style={{ margin: "5px", color: "#777" }} className='button'>
            &lt;&nbsp;prev
          </div>
        )}
        {internalState?.nextPhoto && internalState?.nextPhoto?.photo ? (
          <Link
            to={`/${internalState?.nextPhoto?.photo?.video === true ? 'videos': 'photos'}/${internalState?.nextPhoto?.photo?.id}${
              embedded ? "?embedded=true" : ""
            }`}
            onClick={async() =>  await loadNext()}
          >
            <div style={{ margin: "5px" }} className='button'>
              next&nbsp;&gt;
            </div>
          </Link>
        ) : (
          <div style={{ margin: "5px", color: "#777" }} className='button'>
            next&nbsp;&gt;
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
          <title>{`${currPhoto?.photo?.video === true ? '(video)':'(photo)'} ${recognitionsLabels(currPhoto?.recognitions[0])}`}</title>
          <meta
            property='og:title'
            content={                            
                `${currPhoto?.photo?.video === true ? '(video)':'(photo)'} ${recognitionsLabels(currPhoto?.recognitions[0])} ${currPhoto.photo.id}`
            }
          />
          <meta
            name='description'
            property='og:description'
            content={
              `${currPhoto?.comments?.length > 0
                ? currPhoto.comments[0].comment
                : ` `} ${recognitionsLabels(currPhoto?.recognitions[0])}`
            }
          />
          <meta
            name='image'
            property='og:image'
            content={`${currPhoto.photo.thumbUrl}`}
          />
          <meta
            property='og:url'
            content={`${currPhoto.photo.thumbUrl}`}
          />

          <link
            rel='canonical'
            href={`https://www.wisaw.com/${currPhoto.photo.video === true ? 'videos': 'photos'}/${currPhoto.photo.id}`}
          />

          <meta
            name='twitter:title'
            content={
              currPhoto?.comments?.length > 0
                ? currPhoto?.comments[0].comment
                : `wisaw ${currPhoto?.photo?.video === true ? '(video)':'(photo)'} ${recognitionsLabels(currPhoto?.recognitions[0])}`
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
              currPhoto?.comments?.length > 0
                ? currPhoto?.comments[0]?.comment
                : `wisaw photo ${currPhoto.photo.id}`
            }
          />
          <meta
            name='twitter:image'
            content={`${currPhoto.photo.thumbUrl}`}
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
            // cursor: "pointer",
          }}
        >
          {currPhoto?.photo?.video === true && (
            <ReactPlayer 
              url={currPhoto?.photo?.videoUrl}
              className='mainImage'
              style={{                
                // maxWidth: `${currPhoto.width/2}`,
                // maxHeight: `${currPhoto.height/2}`,
                width: `${dimensions.width}`,
                height: `${dimensions.height}`,
              }}
  
              playing={true}
              controls={true}

            />)}

          {currPhoto?.photo?.video !== true && (
            <img
              width={`${dimensions.width}`}
              height={`${dimensions.height}`}
              className='mainImage'
              src={screenWidth < 700 ? `${currPhoto.photo.thumbUrl}` : `${currPhoto.photo.imgUrl}`}
              alt={
                currPhoto?.comments?.length > 0
                  ? currPhoto?.comments[0]?.comment
                  : `wisaw photo ${currPhoto.photo.id}`
              }
              style={{
                // width: `${currPhoto.width + 100}`,
                // height: `${currPhoto.height + 100}`,
                backgroundImage: `url("${currPhoto.photo.thumbUrl}")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                // width:`${dimensions.width}`,
                // height:`${dimensions.height}`,
                }}
          />)}
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
            {currPhoto?.comments && currPhoto?.comments?.length > 0 && (
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
                {currPhoto?.comments?.length}
              </div>
            )}
          </div>
          <div style={{ margin: "10px", align: "center" }}>
            {currPhoto &&
              currPhoto.photo &&
              currPhoto.photo.watchersCount > 0 && (
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
                    <h2
                      style={{
                        margin: "10",
                        fontFamily: "Comic Sans MS,Comic Sans,sans-serif",
                      }}
                    >
                      {comment.comment}
                    </h2>
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
            renderRecognitions(currPhoto?.recognitions[0])}

          <div style={{ margin: "10px", align: "center" }} />
        </div>
        <Footer />
      </div>
    )
  }

  if (requestComplete === true && (currPhoto === null || currPhoto?.photo === null)) {
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
