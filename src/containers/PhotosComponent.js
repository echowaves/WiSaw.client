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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalState])

  /**
this methid will fetch image into cache -- will work super fast on next call to the same url
*/
  const fetchDimensions = async ({photoId}) => {
    try {
      const img = new Image()
      img.src = `https://img.wisaw.com/${photoId}-thumb.webp`
      await img.decode()

      const maxDimention = screenWidth < 700 ? 300 : 700
      const {naturalWidth,  naturalHeight} = img

      setDimensions({
        width: naturalWidth > naturalHeight ?  maxDimention : maxDimention * naturalWidth / naturalHeight, //img.naturalWidth,
        height: naturalWidth < naturalHeight ? maxDimention: maxDimention * naturalHeight  / naturalWidth, //img.naturalHeight,
      })
    } catch (err) {
      console.error("Error fetching image dimensions:", err.message)
      // Set fallback dimensions
      setDimensions({width: 300, height: 300})
    }
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
                      <Link key={label.Name} to={`/search/${encodeURIComponent(label.Name)}`}>
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


      return (
        <div>
          {labels?.length > 0 && (
            <div style={{ margin: "5px" }}>            
              <h2>
                {labels.slice(3,6).map((label) => (                                
                  <Link key={label.Name} to={`/search/${encodeURIComponent(label.Name)}`}>
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h2>
              <h3>
                {labels.slice(6,9).map((label) => (                                
                  <Link key={label.Name} to={`/search/${encodeURIComponent(label.Name)}`}>
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h3>
              <h4>
                {labels.slice(9,12).map((label) => (                                
                  <Link key={label.Name} to={`/search/${encodeURIComponent(label.Name)}`}>
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h4>
              <h5>
                {labels.slice(12,15).map((label) => (                                
                  <Link key={label.Name} to={`/search/${encodeURIComponent(label.Name)}`}>
                    {stringifyObject(label.Name).replace(/'/g, "")}
                  </Link>                                    
                ))}
              </h5>
              <h6>
                {labels.slice(15).map((label) => (                                
                  <Link key={label.Name} to={`/search/${encodeURIComponent(label.Name)}`}>
                    {stringifyObject(label.Name).replace(/'/g, "")}&nbsp;
                  </Link>                                    
                ))}
              </h6>
            </div>
          )}

          {textDetections?.length > 0 && (
            <div style={{ margin: "20px 0" }}>
              <div style={{ textAlign: "center", marginBottom: "15px" }}>
                <b className="text-detection" style={{
                  fontSize: "18px",
                  fontWeight: '700'
                }}>Recognized Text</b>
              </div>
              <div style={{ textAlign: "center" }}>
                {textDetections.map((text) => (
                  <h2 key={text.Id} style={{ margin: "10px 0" }}>
                    <div className="text-detection" style={{ 
                      fontSize: `${Math.max(Math.min(text.Confidence, 100), 60)}%`,
                      lineHeight: 1.4
                    }}>
                      {stringifyObject(text.DetectedText).replace(/'/g, "")}
                    </div>
                  </h2>
                ))}
              </div>
            </div>
          )}

          {moderationLabels?.length > 0 && (
            <div style={{ margin: "20px 0", paddingBottom: "15px" }}>
              <div style={{ textAlign: "center", marginBottom: "15px" }}>
                <b className="moderation-labels" style={{
                  fontSize: "18px",
                  fontWeight: '700'
                }}>Moderation Tags</b>
              </div>
              <div style={{ textAlign: "center" }}>
                {moderationLabels.map((label) => (
                  <h3 key={label.Name} style={{ margin: "8px 0" }}>
                    <div className="moderation-labels" style={{ 
                      fontSize: `${Math.max(Math.min(label.Confidence, 100), 60)}%`,
                      lineHeight: 1.4
                    }}>
                      {stringifyObject(label.Name).replace(/'/g, "")}
                    </div>
                  </h3>
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

  if (currPhoto && currPhoto?.photo) {
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
                  backgroundImage: screenWidth < 700 ? `none`: `url("${currPhoto.photo.thumbUrl}")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  // width:`${dimensions.width}`,
                  // height:`${dimensions.height}`,
                  }}
            />)}
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
