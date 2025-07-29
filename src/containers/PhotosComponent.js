/* eslint-disable react/react-in-jsx-scope */
import { lazy, useEffect, useState } from "react"
import ReactPlayer from 'react-player'

import { Helmet } from "react-helmet-async"

import ReactGA from "react-ga4"



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
  const [imageLoaded, setImageLoaded] = useState(false)

  const { photoId } = useParams()

  useEffect(() => {
    if (photoId) {
      // Reset state when navigating to show loading
      setInternalState({
        currPhoto: null,
        nextPhoto: null,
        prevPhoto: null,
        requestComplete: false,
      })
      setImageLoaded(false)
      load({ photoId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if(internalState.requestComplete) {
      ReactGA.send({
        hitType: "pageview",
        page: internalState?.currPhoto?.photo?.video === true ? 
        `/videos/${internalState?.currPhoto?.photo?.id}` : `/photos/${internalState?.currPhoto?.photo?.id}` ,
        // title: "Custom Title",
      })
      
      // Reset image loading state when photo data changes
      setImageLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalState])

  /**
   * Get dimensions from GraphQL instead of manual image loading
   */
  const getDimensionsFromPhoto = (photo) => {
    if (!photo?.width || !photo?.height) {
      return {width: 300, height: 300}
    }
    
    const screenWidth = window.innerWidth
    const maxDimension = screenWidth < 700 ? 300 : 700
    const naturalWidth = photo.width
    const naturalHeight = photo.height
    
    return {
      width: naturalWidth > naturalHeight ? maxDimension : maxDimension * naturalWidth / naturalHeight,
      height: naturalWidth < naturalHeight ? maxDimension : maxDimension * naturalHeight / naturalWidth,
    }
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleImageError = () => {
    console.log('Image failed to load, falling back to thumbnail only')
    // On error, just keep the thumbnail visible by setting imageLoaded to true
    // This prevents infinite loading states
    setImageLoaded(true)
  }

  const fetchCurrPhoto = async ({ photoId }) => {
    try {
      const response = (
        await CONST.gqlClient.query({
          query: gql`
            query getPhotoAllCurr($photoId: String!) {
              getPhotoAllCurr(photoId: $photoId) {
                photo {
                  imgUrl
                  id
                  thumbUrl
                  watchersCount
                  video
                  videoUrl
                  width
                  height
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
            query getPhotoAllPrev($photoId: String!) {
              getPhotoAllPrev(photoId: $photoId) {
                photo {
                  imgUrl
                  id
                  thumbUrl
                  watchersCount
                  video
                  videoUrl
                  width
                  height
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
            query getPhotoAllNext($photoId: String!) {
              getPhotoAllNext(photoId: $photoId) {
                photo {
                  imgUrl
                  id
                  thumbUrl
                  watchersCount
                  video
                  videoUrl
                  width
                  height
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

    // Calculate dimensions immediately from GraphQL data to prevent layout shift
    if(results[0]?.photo) {
      const calculatedDimensions = getDimensionsFromPhoto(results[0].photo)
      setDimensions(calculatedDimensions)
    } else {
      setDimensions({width: 300, height: 300})
    }

    setInternalState({
      currPhoto: results[0],
      nextPhoto: results[1],
      prevPhoto: results[2],
      requestComplete: true,
    })
  }

  const recognitionsLabels = (recognition, lebelsToInclude = 10) => {    
    if(!recognition) return ''
    try {
      return JSON.parse(recognition.metaData)?.Labels?.slice(0, lebelsToInclude).map((label) => label.Name).join(", ")
    } catch (err) {
      console.error("Error parsing recognition data:", err.message)
      return ''
    }
  }

  const renderRecognitionsH1 = (recognition) => {    
    if(!recognition) return(<div/>)
    try {
      const labels = JSON.parse(recognition?.metaData)?.Labels

      return (
        <div>
          {labels?.length > 0 && (
            <div style={{ margin: "5px" }}>
              <h1>
                {labels.slice(0,3).map((label) => (                                
                      <Link 
                        key={label.Name} 
                        to={`/search/${encodeURIComponent(label.Name)}`}
                        style={{
                          opacity: Math.max(0.6, label.Confidence / 100),
                          fontSize: `${Math.max(0.8, label.Confidence / 100)}em`,
                          fontWeight: Math.max(400, 400 + (label.Confidence / 100) * 300)
                        }}
                      >
                        {stringifyObject(label.Name).replace(/'/g, "")}
                      </Link>                                    
                ))}
                </h1>
            </div>
          )}
          
        </div>
      )
    } catch (err) {
      console.error("Error rendering recognition data:", err.message)
      return <div/>
    }
  }

  const renderRecognitions = (recognition) => {    
    if(!recognition) return(<div/>)
    try {
      const labels = JSON.parse(recognition?.metaData)?.Labels
      const textDetections = JSON.parse(
        recognition.metaData,
      ).TextDetections?.filter((text) => text?.Type === "LINE")
      const moderationLabels = JSON.parse(recognition?.metaData)?.ModerationLabels

      // Helper function to get confidence-based styles
      const getConfidenceStyle = (confidence) => ({
        opacity: Math.max(0.5, confidence / 100),
        fontSize: `${Math.max(0.7, confidence / 100)}em`,
        fontWeight: Math.max(400, 400 + (confidence / 100) * 300),
        transform: `scale(${Math.max(0.85, confidence / 100)})`,
        borderWidth: `${Math.max(1, (confidence / 100) * 3)}px`
      })

      return (
        <div>
          {labels?.length > 0 && (
            <div style={{ margin: "5px" }}>            
              <h2>
                {labels.slice(3,6).map((label) => (                                
                  <Link 
                    key={label.Name} 
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h2>
              <h3>
                {labels.slice(6,9).map((label) => (                                
                  <Link 
                    key={label.Name} 
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h3>
              <h4>
                {labels.slice(9,12).map((label) => (                                
                  <Link 
                    key={label.Name} 
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h4>
              <h5>
                {labels.slice(12,15).map((label) => (                                
                  <Link 
                    key={label.Name} 
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h5>
              <h6>
                {labels.slice(15).map((label) => (                                
                  <Link 
                    key={label.Name} 
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, "")}&nbsp;
                  </Link>                                    
                ))}
              </h6>
            </div>
          )}

          {textDetections?.length > 0 && (
            <div style={{ 
              margin: "20px 0",
              padding: "25px",
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "16px",
              backdropFilter: "blur(15px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
            }}>
              <div style={{ 
                textAlign: "center", 
                marginBottom: "20px",
                padding: "10px 0",
                borderBottom: "2px solid rgba(0, 255, 148, 0.2)"
              }}>
                <h3 style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  margin: "0",
                  background: "linear-gradient(135deg, #00ff94 0%, #720cf0 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow: "none"
                }}>📝 Recognized Text</h3>
              </div>
              <div style={{ 
                textAlign: "center",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "8px"
              }}>
                {textDetections.map((text) => (
                  <div key={text.Id} style={{ 
                    fontSize: `${Math.max(Math.min(text.Confidence, 100), 60)}%`,
                    lineHeight: 1.6,
                    opacity: Math.max(0.6, text.Confidence / 100),
                    fontWeight: Math.max(500, 500 + (text.Confidence / 100) * 200),
                    padding: "8px 14px",
                    background: "linear-gradient(135deg, rgba(0, 255, 148, 0.1) 0%, rgba(114, 12, 240, 0.1) 100%)",
                    borderRadius: "20px",
                    border: "1px solid rgba(0, 255, 148, 0.2)",
                    display: "inline-block",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(0, 255, 148, 0.1)"
                  }}>
                    &ldquo;{stringifyObject(text.DetectedText).replace(/'/g, "")}&rdquo;
                  </div>
                ))}
              </div>
            </div>
          )}

          {moderationLabels?.length > 0 && (
            <div style={{ 
              margin: "20px 0", 
              padding: "25px",
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "16px",
              backdropFilter: "blur(15px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
            }}>
              <div style={{ 
                textAlign: "center", 
                marginBottom: "20px",
                padding: "10px 0",
                borderBottom: "2px solid rgba(255, 94, 77, 0.2)"
              }}>
                <h3 style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  margin: "0",
                  background: "linear-gradient(135deg, #ff5e4d 0%, #d32f2f 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow: "none"
                }}>⚠️ Content Moderation</h3>
              </div>
              <div style={{ 
                textAlign: "center",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "8px"
              }}>
                {moderationLabels.map((label) => (
                  <div key={label.Name} style={{ 
                    fontSize: `${Math.max(Math.min(label.Confidence, 100), 60)}%`,
                    lineHeight: 1.6,
                    opacity: Math.max(0.6, label.Confidence / 100),
                    fontWeight: Math.max(500, 500 + (label.Confidence / 100) * 200),
                    padding: "8px 14px",
                    background: "linear-gradient(135deg, rgba(255, 94, 77, 0.1) 0%, rgba(211, 47, 47, 0.1) 100%)",
                    borderRadius: "18px",
                    border: "1px solid rgba(255, 94, 77, 0.3)",
                    display: "inline-block",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(255, 94, 77, 0.1)"
                  }}>
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    } catch (err) {
      console.error("Error rendering recognition data:", err.message)
      return <div/>
    }
  }

  const location = useLocation()

  const renderNavigationButtons = () => {
    // const { nextPhoto, prevPhoto } = internalState
    const embedded = new URLSearchParams(location.search).get("embedded")
    
    return (
      <div className='lander'>      
        {internalState?.prevPhoto && internalState?.prevPhoto?.photo ? (
          <Link
            to={`/${internalState?.prevPhoto?.photo?.video === true ? 'videos': 'photos'}/${encodeURIComponent(internalState?.prevPhoto?.photo?.id)}${
              embedded ? "?embedded=true" : ""
            }`}
          >
            <div style={{ margin: "5px" }} className='button'>
            &lt;&nbsp;prev
            </div>
          </Link>
        ) : (
            <div/>          
        )}
        {internalState?.nextPhoto && internalState?.nextPhoto?.photo ? (
          <Link
            to={`/${internalState?.nextPhoto?.photo?.video === true ? 'videos': 'photos'}/${encodeURIComponent(internalState?.nextPhoto?.photo?.id)}${
              embedded ? "?embedded=true" : ""
            }`}
          >            
            <div style={{ margin: "5px" }} className='button'>
              next&nbsp;&gt;
            </div>
          </Link>
        ) : (
          <div/>          
        )}
      </div>
    )
  }

  

  const { currPhoto, requestComplete } = internalState
  
  // const embedded = new URLSearchParams(location.search).get("embedded")

  if (currPhoto && currPhoto?.photo && dimensions.width && dimensions.height) {
    const safeDescription = currPhoto?.comments?.length > 0
      ? `${currPhoto.comments[0].comment || ''}, ${recognitionsLabels(currPhoto?.recognitions[0], 5)}`.slice(0, 150)
      : recognitionsLabels(currPhoto?.recognitions[0], 10);
    
    const safeTitle = `${currPhoto?.photo?.video === true ? '(video)':'(photo)'} ${recognitionsLabels(currPhoto?.recognitions[0], 3)}`;
    
    return (
      <div className='PhotosComponent'>
        <div className="content-container">
          {/* <HelmetProvider> */}
          <Helmet prioritizeSeoTags>
            <title>{safeTitle}</title>
            <meta
              property='og:title'
              content={`${safeTitle} ${currPhoto.photo.id}`}
            />
            <meta
              name='description'
              property='og:description'
              content={safeDescription}
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
              href={`https://wisaw.com/${currPhoto.photo.video === true ? 'videos': 'photos'}/${currPhoto.photo.id}`}
            />

            <meta
              name='twitter:title'
              content={
                currPhoto?.comments?.length > 0 && currPhoto?.comments[0].comment
                  ? currPhoto?.comments[0].comment
                  : `wisaw ${safeTitle}`
              }
            />
            <meta
              name='twitter:card'
              content={`Check out what I saw today:
              ${currPhoto.comments
                .slice(0, 3)
                .map((comment) => comment.comment || '')
                .filter(Boolean)
                .join("\n")}`}
            />
            <meta
              name='twitter:description'
              content={safeDescription}
            />
            <meta
              name='twitter:image'
              content={`${currPhoto.photo.thumbUrl}`}
            />
            <meta property='og:type' content='article' />
          </Helmet>
          {/* </HelmetProvider> */}

          <div className="recognition-tags">
            {currPhoto.recognitions &&
                renderRecognitionsH1(currPhoto?.recognitions[0])}
          </div>

          {renderNavigationButtons()}

          <div // eslint-disable-line
            className='crop'
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              position: "relative",
              // cursor: "pointer",
            }}
          >
            {currPhoto?.photo?.video === true && (
              <ReactPlayer 
                url={currPhoto?.photo?.videoUrl}
                className='mainImage'
                width={`${dimensions.width}px`}
                height={`${dimensions.height}px`}
                style={{                
                  width: `${dimensions.width}px`,
                  height: `${dimensions.height}px`,
                }}
    
                playing={true}
                controls={true}

              />)}

            {currPhoto?.photo?.video !== true && (
              <>
                {/* Thumbnail as base layer - always visible */}
                <img
                  width={`${dimensions.width}`}
                  height={`${dimensions.height}`}
                  className='thumbnailImage'
                  src={currPhoto.photo.thumbUrl}
                  alt={
                    currPhoto?.comments?.length > 0
                      ? currPhoto?.comments[0]?.comment
                      : `wisaw photo ${currPhoto.photo.id}`
                  }
                  style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    borderRadius: '18px',
                    objectFit: 'cover',
                    zIndex: 1,
                  }}
                />

                {/* Full-size image as overlay - loads progressively */}
                {screenWidth >= 700 && (
                  <img
                    width={`${dimensions.width}`}
                    height={`${dimensions.height}`}
                    className='mainImage'
                    src={currPhoto.photo.imgUrl}
                    alt={
                      currPhoto?.comments?.length > 0
                        ? currPhoto?.comments[0]?.comment
                        : `wisaw photo ${currPhoto.photo.id}`
                    }
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    style={{
                      width: `${dimensions.width}px`,
                      height: `${dimensions.height}px`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      borderRadius: '18px',
                      objectFit: 'cover',
                      opacity: imageLoaded ? 1 : 0,
                      transition: 'opacity 0.5s ease-in-out',
                      zIndex: 2,
                    }}
                  />
                )}
              </>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {currPhoto.comments && currPhoto.comments.length > 0 && (
              <div className="comments-section">
                {currPhoto.comments.map((comment, i) => (
                  <div key={comment.id}>
                    {i === 0 && (
                      <p
                        className="comment-text"
                        style={{
                          fontSize: 24,
                          fontWeight: 600,
                        }}
                      >
                        {comment.comment}
                      </p>
                    )}
                    {i > 0 && (
                      <p
                        className="comment-text"
                        style={{
                          fontSize: 18,
                          fontWeight: 400,
                        }}
                      >
                        {comment.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="recognition-tags">
              {currPhoto.recognitions &&
                renderRecognitions(currPhoto?.recognitions[0])}
            </div>

            <div style={{ margin: "10px", align: "center" }} />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (requestComplete === true && (currPhoto === null || currPhoto?.photo === null)) {
    return (
      <div className='PhotosComponent'>
        <div className="content-container">
          {renderNavigationButtons()}
          <NoMatch />
        </div>
      </div>
    )
  }

  // Show loading state with reserved space if we don't have dimensions yet
  if (!requestComplete || !currPhoto || !dimensions.width || !dimensions.height) {
    return (
      <div className='PhotosComponent'>
        <div className="content-container" style={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px' 
        }}>
          {/* Reserve space for navigation */}
          <div style={{ height: '60px', width: '100%', marginBottom: '20px' }}>
            <div className="loading-spinner" style={{ width: '30px', height: '30px', margin: '0 auto' }}></div>
          </div>
          
          {/* Reserve space for main image */}
          <div style={{ 
            width: '300px', 
            height: '300px', 
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <div className="loading-spinner"></div>
          </div>
          
          {/* Reserve space for comments/recognition */}
          <div style={{ height: '100px', width: '100%' }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className='PhotosComponent'>
      <div className="content-container" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <div className="loading-spinner"></div>
      </div>
    </div>
  )
}

export default PhotosComponent
