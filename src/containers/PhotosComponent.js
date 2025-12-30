/* eslint-disable react/react-in-jsx-scope */
import { lazy, useCallback, useEffect, useRef, useState } from 'react'

import { Helmet } from 'react-helmet-async'

import ReactGA from 'react-ga4'

import './PhotosComponent.css'

import {
  Link,
  // NavLink,
  useLocation,
  useParams
} from 'react-router-dom'

// import PropTypes from 'prop-types'
import { gql } from '@apollo/client'
import stringifyObject from 'stringify-object'
import NoMatch from './NoMatch.js'

import * as CONST from '../consts'

const Footer = lazy(() => import('./Footer'))

const PhotosComponent = function () {
  const [internalState, setInternalState] = useState({
    currPhoto: null,
    nextPhoto: null,
    prevPhoto: null,
    requestComplete: false
  })

  const [dimensions, setDimensions] = useState({ width: null, height: null })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(null)

  const videoRef = useRef(null)

  const preloadedMedia = useRef(new Set())
  const photoPageCache = useRef(new Map())
  const inflightPhotoRequests = useRef(new Map())

  const preloadImage = useCallback((url) => {
    if (!url || typeof window === 'undefined') {
      return
    }

    if (preloadedMedia.current.has(url)) {
      return
    }

    preloadedMedia.current.add(url)

    const img = new window.Image()
    img.decoding = 'async'
    img.src = url
    img.onerror = () => {
      preloadedMedia.current.delete(url)
    }
  }, [preloadedMedia])
  useEffect(() => {
    if (internalState.requestComplete) {
      ReactGA.send({
        hitType: 'pageview',
        page: internalState?.currPhoto?.photo?.video === true
          ? `/videos/${internalState?.currPhoto?.photo?.id}`
          : `/photos/${internalState?.currPhoto?.photo?.id}`
        // title: "Custom Title",
      })

      // Reset image loading state when photo data changes
      setImageLoaded(false)
    }
  }, [internalState])

  useEffect(() => {
    const candidates = [
      internalState.currPhoto,
      internalState.nextPhoto,
      internalState.prevPhoto
    ]

    candidates.forEach((entry) => {
      if (!entry?.photo) {
        return
      }

      preloadImage(entry.photo.thumbUrl)

      if (entry.photo.video !== true) {
        preloadImage(entry.photo.imgUrl)
      }
    })
  }, [internalState.currPhoto, internalState.nextPhoto, internalState.prevPhoto, preloadImage])

  useEffect(() => {
    if (showVideoPlayer) {
      if (videoRef.current) {
        const playPromise = videoRef.current.play()
        if (typeof playPromise?.catch === 'function') {
          playPromise.catch(() => {
            setVideoError('Unable to start playback automatically. Please press play to continue.')
          })
        }
      }
    } else {
      setVideoReady(false)
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
    }
  }, [showVideoPlayer])

  /**
   * Get dimensions from GraphQL instead of manual image loading
   */
  const getDimensionsFromPhoto = useCallback((photo) => {
    if (!photo?.width || !photo?.height) {
      return { width: 300, height: 300 }
    }

    const screenWidth = window.innerWidth

    if (screenWidth < 700) {
      const width = screenWidth - 40
      const height = (photo.height / photo.width) * width
      return { width, height }
    }

    const maxDimension = 700
    const naturalWidth = photo.width
    const naturalHeight = photo.height

    return {
      width: naturalWidth > naturalHeight ? maxDimension : maxDimension * naturalWidth / naturalHeight,
      height: naturalWidth < naturalHeight ? maxDimension : maxDimension * naturalHeight / naturalWidth
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (internalState.currPhoto?.photo) {
        setDimensions(getDimensionsFromPhoto(internalState.currPhoto.photo))
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [internalState.currPhoto, getDimensionsFromPhoto])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleImageError = () => {
    console.log('Image failed to load, falling back to thumbnail only')
    // On error, just keep the thumbnail visible by setting imageLoaded to true
    // This prevents infinite loading states
    setImageLoaded(true)
  }

  const handleVideoPlayRequest = () => {
    setVideoError(null)
    setVideoReady(false)
    if (videoRef.current) {
      videoRef.current.load()
    }
    setShowVideoPlayer(true)
  }

  const handleVideoLoadedData = () => {
    setVideoReady(true)
    setVideoError(null)
  }

  const handleVideoError = () => {
    setVideoReady(false)
    setVideoError('This video is unavailable right now.')
  }

  const fetchCurrPhoto = useCallback(async ({ photoId }) => {
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
                  createdAt
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
            photoId
          }
        })
      ).data.getPhotoAllCurr

      const { photo } = response
      if (photo) {
        return {
          ...response
        }
      }
    } catch (err) {
      console.log({ err }) // eslint-disable-line
    }
    return null
  }, [])

  const fetchPrevPhoto = useCallback(async ({ photoId }) => {
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
                  createdAt
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
            photoId
          }
        })
      ).data.getPhotoAllPrev

      const { photo } = response

      if (photo) {
        return {
          ...response
        }
      }
    } catch (err) {
      console.log({ err }) // eslint-disable-line
    }

    return null
  }, [])

  const fetchNextPhoto = useCallback(async ({ photoId }) => {
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
                  createdAt
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
            photoId
          }
        })
      ).data.getPhotoAllNext

      const { photo } = response

      if (photo) {
        return {
          ...response
        }
      }
    } catch (err) {
      console.log({ err }) // eslint-disable-line
    }

    return null
  }, [])

  const buildPhotoPage = useCallback(async (photoId) => {
    if (!photoId) {
      return {
        currPhoto: null,
        nextPhoto: null,
        prevPhoto: null,
        dimensions: { width: 300, height: 300 }
      }
    }

    if (photoPageCache.current.has(photoId)) {
      return photoPageCache.current.get(photoId)
    }

    if (inflightPhotoRequests.current.has(photoId)) {
      return inflightPhotoRequests.current.get(photoId)
    }

    const requestPromise = (async () => {
      const [curr, next, prev] = await Promise.all([
        fetchCurrPhoto({ photoId }),
        fetchNextPhoto({ photoId }),
        fetchPrevPhoto({ photoId })
      ])

      const pageData = {
        currPhoto: curr,
        nextPhoto: next,
        prevPhoto: prev,
        dimensions: curr?.photo
          ? getDimensionsFromPhoto(curr.photo)
          : { width: 300, height: 300 }
      }

      photoPageCache.current.set(photoId, pageData)
      inflightPhotoRequests.current.delete(photoId)
      return pageData
    })()

    inflightPhotoRequests.current.set(photoId, requestPromise)
    return requestPromise
  }, [fetchCurrPhoto, fetchNextPhoto, fetchPrevPhoto, getDimensionsFromPhoto])

  const preloadPhotoPage = useCallback((photoId) => {
    if (!photoId) {
      return
    }

    buildPhotoPage(photoId).catch(() => { })
  }, [buildPhotoPage])

  const load = useCallback(async ({ photoId }) => {
    const pageData = await buildPhotoPage(photoId)

    const calculatedDimensions = pageData?.dimensions || { width: 300, height: 300 }
    setDimensions(calculatedDimensions)

    setInternalState({
      currPhoto: pageData?.currPhoto,
      nextPhoto: pageData?.nextPhoto,
      prevPhoto: pageData?.prevPhoto,
      requestComplete: true
    })

    preloadPhotoPage(pageData?.nextPhoto?.photo?.id)
    preloadPhotoPage(pageData?.prevPhoto?.photo?.id)
  }, [buildPhotoPage, preloadPhotoPage])

  const { photoId } = useParams()

  useEffect(() => {
    if (photoId) {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
      }
      setInternalState({
        currPhoto: null,
        nextPhoto: null,
        prevPhoto: null,
        requestComplete: false
      })
      setImageLoaded(false)
      setShowVideoPlayer(false)
      setVideoReady(false)
      setVideoError(null)
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      load({ photoId })
    }
  }, [load, photoId])

  const recognitionsLabels = (recognition, lebelsToInclude = 10) => {
    if (!recognition) return ''
    try {
      return JSON.parse(recognition.metaData)?.Labels?.slice(0, lebelsToInclude).map((label) => label.Name).join(', ')
    } catch (err) {
      console.error('Error parsing recognition data:', err.message)
      return ''
    }
  }

  const renderRecognitionsH1 = (recognition) => {
    if (!recognition) return (<div />)
    try {
      const labels = JSON.parse(recognition?.metaData)?.Labels

      return (
        <div>
          {labels?.length > 0 && (
            <div style={{ margin: '4px 0 8px' }}>
              <h1>
                {labels.slice(0, 3).map((label) => (
                  <Link
                    key={label.Name}
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={{
                      opacity: Math.max(0.6, label.Confidence / 100),
                      fontSize: `${Math.max(0.8, label.Confidence / 100)}em`,
                      fontWeight: Math.max(400, 400 + (label.Confidence / 100) * 300)
                    }}
                  >
                    {stringifyObject(label.Name).replace(/'/g, '')}
                  </Link>
                ))}
              </h1>
            </div>
          )}

        </div>
      )
    } catch (err) {
      console.error('Error rendering recognition data:', err.message)
      return <div />
    }
  }

  const renderRecognitions = (recognition) => {
    if (!recognition) return (<div />)
    try {
      const labels = JSON.parse(recognition?.metaData)?.Labels
      const textDetections = JSON.parse(
        recognition.metaData
      ).TextDetections?.filter((text) => text?.Type === 'LINE')
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
            <div style={{ margin: '4px 0 8px' }}>
              <h2>
                {labels.slice(3, 6).map((label) => (
                  <Link
                    key={label.Name}
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, '')}
                  </Link>
                ))}
              </h2>
              <h3>
                {labels.slice(6, 9).map((label) => (
                  <Link
                    key={label.Name}
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, '')}
                  </Link>
                ))}
              </h3>
              <h4>
                {labels.slice(9, 12).map((label) => (
                  <Link
                    key={label.Name}
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, '')}
                  </Link>
                ))}
              </h4>
              <h5>
                {labels.slice(12, 15).map((label) => (
                  <Link
                    key={label.Name}
                    to={`/search/${encodeURIComponent(label.Name)}`}
                    style={getConfidenceStyle(label.Confidence)}
                  >
                    {stringifyObject(label.Name).replace(/'/g, '')}
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
                    {stringifyObject(label.Name).replace(/'/g, '')}&nbsp;
                  </Link>
                ))}
              </h6>
            </div>
          )}

          {textDetections?.length > 0 && (
            <div style={{
              margin: '12px 0',
              padding: '18px',
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)'
            }}
            >
              <div style={{
                textAlign: 'center',
                marginBottom: '12px',
                padding: '6px 0',
                borderBottom: '2px solid rgba(0, 255, 148, 0.2)'
              }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  margin: '0',
                  background: 'linear-gradient(135deg, #00ff94 0%, #720cf0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: 'none'
                }}
                >📝 Recognized Text
                </h3>
              </div>
              <div style={{
                textAlign: 'center',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '6px'
              }}
              >
                {textDetections.map((text) => (
                  <div
                    key={text.Id} style={{
                      fontSize: `${Math.max(Math.min(text.Confidence, 100), 60)}%`,
                      lineHeight: 1.6,
                      opacity: Math.max(0.6, text.Confidence / 100),
                      fontWeight: Math.max(500, 500 + (text.Confidence / 100) * 200),
                      padding: '6px 12px',
                      background: 'linear-gradient(135deg, rgba(0, 255, 148, 0.1) 0%, rgba(114, 12, 240, 0.1) 100%)',
                      borderRadius: '14px',
                      border: '1px solid rgba(0, 255, 148, 0.2)',
                      display: 'inline-block',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(0, 255, 148, 0.1)'
                    }}
                  >
                    &ldquo;{stringifyObject(text.DetectedText).replace(/'/g, '')}&rdquo;
                  </div>
                ))}
              </div>
            </div>
          )}

          {moderationLabels?.length > 0 && (
            <div style={{
              margin: '12px 0',
              padding: '18px',
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)'
            }}
            >
              <div style={{
                textAlign: 'center',
                marginBottom: '12px',
                padding: '6px 0',
                borderBottom: '2px solid rgba(255, 94, 77, 0.2)'
              }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  margin: '0',
                  background: 'linear-gradient(135deg, #ff5e4d 0%, #d32f2f 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: 'none'
                }}
                >⚠️ Content Moderation
                </h3>
              </div>
              <div style={{
                textAlign: 'center',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '6px'
              }}
              >
                {moderationLabels.map((label) => (
                  <div
                    key={label.Name} style={{
                      fontSize: `${Math.max(Math.min(label.Confidence, 100), 60)}%`,
                      lineHeight: 1.6,
                      opacity: Math.max(0.6, label.Confidence / 100),
                      fontWeight: Math.max(500, 500 + (label.Confidence / 100) * 200),
                      padding: '6px 12px',
                      background: 'linear-gradient(135deg, rgba(255, 94, 77, 0.1) 0%, rgba(211, 47, 47, 0.1) 100%)',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 94, 77, 0.3)',
                      display: 'inline-block',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(255, 94, 77, 0.1)'
                    }}
                  >
                    {stringifyObject(label.Name).replace(/'/g, '')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    } catch (err) {
      console.error('Error rendering recognition data:', err.message)
      return <div />
    }
  }

  const location = useLocation()

  const renderNavigationButtons = () => {
    // const { nextPhoto, prevPhoto } = internalState
    const embedded = new URLSearchParams(location.search).get('embedded')
    const embeddedSuffix = embedded ? '?embedded=true' : ''
    const prevPhoto = internalState?.prevPhoto?.photo
    const nextPhoto = internalState?.nextPhoto?.photo

    const prevPhotoLink = prevPhoto
      ? `/${prevPhoto.video === true ? 'videos' : 'photos'}/${encodeURIComponent(prevPhoto.id)}${embeddedSuffix}`
      : null

    const nextPhotoLink = nextPhoto
      ? `/${nextPhoto.video === true ? 'videos' : 'photos'}/${encodeURIComponent(nextPhoto.id)}${embeddedSuffix}`
      : null

    const renderPrevButton = () => {
      if (!prevPhotoLink) {
        return <div />
      }

      return (
        <Link
          to={prevPhotoLink}
          onMouseEnter={() => preloadPhotoPage(prevPhoto?.id)}
          onFocus={() => preloadPhotoPage(prevPhoto?.id)}
          style={{
            position: 'absolute',
            right: '10px',
            top: '10px',
            zIndex: 10
          }}
        >
          <div style={{ margin: '4px' }} className='button'>
            &lt;&nbsp;prev
          </div>
        </Link>
      )
    }

    const renderNextButton = () => {
      if (!nextPhotoLink) {
        return <div />
      }

      return (
        <Link
          to={nextPhotoLink}
          onMouseEnter={() => preloadPhotoPage(nextPhoto?.id)}
          onFocus={() => preloadPhotoPage(nextPhoto?.id)}
          style={{
            position: 'absolute',
            left: '10px',
            top: '10px',
            zIndex: 10
          }}
        >
          <div style={{ margin: '4px' }} className='button'>
            next&nbsp;&gt;
          </div>
        </Link>
      )
    }

    return (
      <>
        {renderPrevButton()}
        {renderNextButton()}
      </>
    )
  }

  const { currPhoto, requestComplete } = internalState

  // const embedded = new URLSearchParams(location.search).get("embedded")

  if (currPhoto && currPhoto?.photo && dimensions.width && dimensions.height) {
    const safeDescription = currPhoto?.comments?.length > 0
      ? `${currPhoto.comments[0].comment || ''}, ${recognitionsLabels(currPhoto?.recognitions[0], 5)}`.slice(0, 150)
      : recognitionsLabels(currPhoto?.recognitions[0], 10) || 'Video content from WiSaw'

    const safeTitle = `${currPhoto?.photo?.video === true ? '(video)' : '(photo)'} ${recognitionsLabels(currPhoto?.recognitions[0], 3) || currPhoto.photo.id}`

    // Create robust titles and descriptions for structured data
    const videoTitle = currPhoto?.photo?.video === true
      ? (recognitionsLabels(currPhoto?.recognitions[0], 3) || `WiSaw Video ${currPhoto.photo.id}`)
      : safeTitle

    const videoDescription = safeDescription || `Video content shared on WiSaw - ${currPhoto.photo.id}`

    // Ensure minimal required fields for VideoObject
    const finalVideoTitle = videoTitle && videoTitle.trim() ? videoTitle.trim() : `WiSaw Video ${currPhoto.photo.id}`
    const finalVideoDescription = videoDescription && videoDescription.trim() ? videoDescription.trim() : `Video content from WiSaw - ID: ${currPhoto.photo.id}`

    return (
      <div className='PhotosComponent'>
        {/* Main article/video content wrapper to establish this as a watch page */}
        <main className='content-container' role='main' style={{ position: 'relative' }}>
          {/* Navigation buttons in upper corners */}
          {renderNavigationButtons()}
          <Helmet prioritizeSeoTags>
            <title>{finalVideoTitle}</title>
            <meta
              property='og:title'
              content={`${finalVideoTitle} ${currPhoto.photo.id}`}
            />
            <meta
              name='description'
              property='og:description'
              content={finalVideoDescription}
            />
            <meta
              name='image'
              property='og:image'
              content={`${currPhoto.photo.thumbUrl}`}
            />
            <meta
              property='og:url'
              content={`https://wisaw.com/${currPhoto.photo.video === true ? 'videos' : 'photos'}/${currPhoto.photo.id}`}
            />

            {/* Video-specific Open Graph tags */}
            {currPhoto?.photo?.video === true && (
              <>
                <meta property='og:type' content='video.other' />
                <meta property='og:video' content={currPhoto.photo.videoUrl} />
                <meta property='og:video:url' content={currPhoto.photo.videoUrl} />
                <meta property='og:video:secure_url' content={currPhoto.photo.videoUrl} />
                <meta property='og:video:type' content='video/mp4' />
                <meta property='og:video:width' content={currPhoto.photo.width || '640'} />
                <meta property='og:video:height' content={currPhoto.photo.height || '360'} />
                <meta property='og:video:image' content={currPhoto.photo.thumbUrl} />
              </>
            )}
            {currPhoto?.photo?.video !== true && (
              <meta property='og:type' content='article' />
            )}

            <link
              rel='canonical'
              href={`https://wisaw.com/${currPhoto.photo.video === true ? 'videos' : 'photos'}/${currPhoto.photo.id}`}
            />

            <meta
              name='twitter:title'
              content={
                currPhoto?.comments?.length > 0 && currPhoto?.comments[0].comment
                  ? currPhoto?.comments[0].comment
                  : `wisaw ${finalVideoTitle}`
              }
            />
            <meta
              name='twitter:card'
              content={currPhoto?.photo?.video === true ? 'player' : 'summary_large_image'}
            />
            {currPhoto?.photo?.video === true && (
              <>
                <meta name='twitter:player' content={currPhoto.photo.videoUrl} />
                <meta name='twitter:player:width' content={currPhoto.photo.width || '640'} />
                <meta name='twitter:player:height' content={currPhoto.photo.height || '360'} />
              </>
            )}
            <meta
              name='twitter:description'
              content={finalVideoDescription}
            />
            <meta
              name='twitter:image'
              content={`${currPhoto.photo.thumbUrl}`}
            />

            {/* Video-specific meta tags for Google */}
            {currPhoto?.photo?.video === true && (
              <>
                <meta name='robots' content='max-video-preview:30' />
                <meta property='video:duration' content='30' />
                <meta property='video:release_date' content={new Date().toISOString()} />
              </>
            )}

            {/* VideoObject structured data for videos */}
            {currPhoto?.photo?.video === true && (
              <script type='application/ld+json'>
                {JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'VideoObject',
                  name: finalVideoTitle,
                  description: finalVideoDescription,
                  thumbnailUrl: [currPhoto.photo.thumbUrl],
                  uploadDate: currPhoto.photo.createdAt || new Date().toISOString(),
                  contentUrl: currPhoto.photo.videoUrl,
                  embedUrl: `https://wisaw.com/videos/${currPhoto.photo.id}`,
                  url: `https://wisaw.com/videos/${currPhoto.photo.id}`,
                  duration: 'PT0M30S',
                  width: parseInt(currPhoto.photo.width, 10) || 640,
                  height: parseInt(currPhoto.photo.height, 10) || 360,
                  videoQuality: 'HD',
                  encodingFormat: currPhoto.photo.videoUrl?.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
                  interactionStatistic: {
                    '@type': 'InteractionCounter',
                    interactionType: { '@type': 'WatchAction' },
                    userInteractionCount: parseInt(currPhoto.photo.watchersCount, 10) || 0
                  },
                  publisher: {
                    '@type': 'Organization',
                    name: 'WiSaw',
                    url: 'https://wisaw.com',
                    logo: {
                      '@type': 'ImageObject',
                      url: 'https://wisaw.com/logo192.png'
                    }
                  },
                  potentialAction: {
                    '@type': 'WatchAction',
                    target: `https://wisaw.com/videos/${currPhoto.photo.id}`
                  }
                })}
              </script>
            )}
          </Helmet>
          {/* </HelmetProvider> */}

          <div className='recognition-tags'>
            {currPhoto.recognitions &&
              renderRecognitionsH1(currPhoto?.recognitions[0])}
          </div>

          <div // eslint-disable-line
            className='crop'
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              position: 'relative'
              // cursor: "pointer",
            }}
          >
            {currPhoto?.photo?.video === true && (
              <>
                {/* Thumbnail as base layer for videos - always visible */}
                <img
                  width={`${dimensions.width}`}
                  height={`${dimensions.height}`}
                  className='thumbnailImage'
                  src={currPhoto.photo.thumbUrl}
                  alt={
                    currPhoto?.comments?.length > 0
                      ? currPhoto?.comments[0]?.comment
                      : `wisaw video ${currPhoto.photo.id}`
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
                    display: showVideoPlayer ? 'none' : 'block' // Hide when video is playing
                  }}
                />

                {/* Play button overlay to indicate video */}
                {!showVideoPlayer && (
                  <div
                    onClick={handleVideoPlayRequest}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleVideoPlayRequest()
                      }
                    }}
                    role='button'
                    tabIndex={0}
                    aria-label='Play video'
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 4,
                      fontSize: '48px',
                      color: 'white',
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      borderRadius: '50%',
                      width: '80px',
                      height: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    ▶
                  </div>
                )}

                {showVideoPlayer && !videoReady && !videoError && (
                  <div
                    className='loading-spinner'
                    aria-label='Loading video'
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 5,
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {videoError && (
                  <div
                    role='alert'
                    style={{
                      position: 'absolute',
                      top: '12%',
                      left: '50%',
                      transform: 'translate(-50%, 0)',
                      zIndex: 5,
                      padding: '16px 20px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.75)',
                      color: '#ffffff',
                      maxWidth: '90%',
                      textAlign: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    {videoError}
                  </div>
                )}

                <video
                  ref={videoRef}
                  className='mainImage'
                  width={dimensions.width}
                  height={dimensions.height}
                  style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    borderRadius: '18px',
                    zIndex: 3,
                    opacity: showVideoPlayer ? 1 : 0,
                    pointerEvents: showVideoPlayer ? 'auto' : 'none',
                    backgroundColor: 'black'
                  }}
                  poster={currPhoto.photo.thumbUrl}
                  controls
                  preload='metadata'
                  playsInline
                  aria-hidden={!showVideoPlayer}
                  aria-label={finalVideoTitle}
                  onLoadedData={handleVideoLoadedData}
                  onPlay={handleVideoLoadedData}
                  onError={handleVideoError}
                >
                  <source src={currPhoto.photo.videoUrl} type='video/mp4' />
                  Your browser does not support the video tag.
                </video>
              </>
            )}

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
                    zIndex: 1
                  }}
                />

                {/* Full-size image as overlay - loads progressively */}
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
                    zIndex: 2
                  }}
                />
              </>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            {currPhoto.comments && currPhoto.comments.length > 0 && (
              <div className='comments-section'>
                {currPhoto.comments.map((comment, i) => (
                  <div key={comment.id}>
                    {i === 0 && (
                      <p
                        className='comment-text'
                        style={{
                          fontSize: 24,
                          fontWeight: 600
                        }}
                      >
                        {comment.comment}
                      </p>
                    )}
                    {i > 0 && (
                      <p
                        className='comment-text'
                        style={{
                          fontSize: 18,
                          fontWeight: 400
                        }}
                      >
                        {comment.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className='recognition-tags'>
              {currPhoto.recognitions &&
                renderRecognitions(currPhoto?.recognitions[0])}
            </div>

            <div style={{ margin: '6px', align: 'center' }} />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (requestComplete === true && (currPhoto === null || currPhoto?.photo === null)) {
    return (
      <div className='PhotosComponent'>
        <div className='content-container'>
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
        <div
          className='content-container' style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px'
          }}
        >
          {/* Reserve space for navigation */}
          <div style={{ height: '60px', width: '100%', marginBottom: '14px' }}>
            <div className='loading-spinner' style={{ width: '30px', height: '30px', margin: '0 auto' }} />
          </div>

          {/* Reserve space for main image */}
          <div style={{
            width: '300px',
            height: '300px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}
          >
            <div className='loading-spinner' />
          </div>

          {/* Reserve space for comments/recognition */}
          <div style={{ height: '100px', width: '100%' }} />
        </div>
      </div>
    )
  }

  return (
    <div className='PhotosComponent'>
      <div
        className='content-container' style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px'
        }}
      >
        <div className='loading-spinner' />
      </div>
    </div>
  )
}

export default PhotosComponent
