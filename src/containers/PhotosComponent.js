/* eslint-disable react/react-in-jsx-scope */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { Helmet } from '@dr.pogodin/react-helmet'

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

/**
 * Display box for the detail media, from the photo's natural dimensions.
 * Module-level so the initial render can size a bootstrapped page too.
 */
const computeDisplayDimensions = (photo) => {
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
}

/**
 * Build a currPhoto record from the feed record Home/Search passed via router
 * state. Only trusted when its id matches the route param; comments and
 * recognitions hydrate from GraphQL shortly after.
 */
const bootstrapPhotoFromRouterState = (routerState, photoId) => {
  const feedPhoto = routerState?.feedPhoto
  if (!feedPhoto?.id || String(feedPhoto.id) !== String(photoId ?? '')) {
    return null
  }
  return { photo: feedPhoto, comments: [], recognitions: [] }
}

/** Media-box placeholder for the cold-load skeleton (aspect ratio unknown). */
const getPlaceholderDimensions = () => {
  if (typeof window === 'undefined') {
    return { width: 300, height: 300 }
  }
  const side = window.innerWidth < 700 ? window.innerWidth - 40 : 700
  return { width: side, height: side }
}

const PhotosComponent = function () {
  const { photoId } = useParams()
  const location = useLocation()

  // Feed cards pass their record via router state; when it matches this route
  // we can paint the real media before any GraphQL response arrives.
  const bootstrappedPhoto = bootstrapPhotoFromRouterState(location.state, photoId)

  const [internalState, setInternalState] = useState(() => ({
    currPhoto: bootstrappedPhoto,
    nextPhoto: null,
    prevPhoto: null,
    requestComplete: false
  }))

  const [dimensions, setDimensions] = useState(() =>
    bootstrappedPhoto
      ? computeDisplayDimensions(bootstrappedPhoto.photo)
      : { width: null, height: null }
  )
  // A bootstrapped photo is already decoded (the feed card just displayed its
  // thumbnail), so paint it immediately instead of hiding it behind a spinner.
  const [imageLoaded, setImageLoaded] = useState(bootstrappedPhoto != null)
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(null)

  const videoRef = useRef(null)

  const loadedMedia = useRef(new Set())
  const inflightMediaPreloads = useRef(new Map())
  const photoPageCache = useRef(new Map())
  const inflightPhotoRequests = useRef(new Map())
  // Latest photoId requested; guards async paints from landing on the wrong page
  const activePhotoIdRef = useRef(null)
  const lastPageviewRef = useRef(null)

  const preloadImage = useCallback((url) => {
    if (!url || typeof window === 'undefined') {
      return
    }

    if (loadedMedia.current.has(url) || inflightMediaPreloads.current.has(url)) {
      return
    }

    const img = new window.Image()
    img.decoding = 'async'
    // Keep a strong reference so the browser cannot GC mid-download
    inflightMediaPreloads.current.set(url, img)
    img.onload = () => {
      loadedMedia.current.add(url)
      inflightMediaPreloads.current.delete(url)
    }
    img.onerror = () => {
      inflightMediaPreloads.current.delete(url)
    }
    img.src = url
  }, [])
  useEffect(() => {
    if (internalState.requestComplete) {
      const page = internalState?.currPhoto?.photo?.video === true
        ? `/videos/${internalState?.currPhoto?.photo?.id}`
        : `/photos/${internalState?.currPhoto?.photo?.id}`
      // Fast paths can set internalState twice for one navigation (bootstrap
      // then hydrate); never pageview the same page twice in a row.
      if (page !== lastPageviewRef.current) {
        lastPageviewRef.current = page
        ReactGA.send({ hitType: 'pageview', page })
      }
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

  useEffect(() => {
    const handleResize = () => {
      if (internalState.currPhoto?.photo) {
        setDimensions(computeDisplayDimensions(internalState.currPhoto.photo))
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [internalState.currPhoto])

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
          ? computeDisplayDimensions(curr.photo)
          : { width: 300, height: 300 }
      }

      photoPageCache.current.set(photoId, pageData)
      inflightPhotoRequests.current.delete(photoId)
      return pageData
    })()

    inflightPhotoRequests.current.set(photoId, requestPromise)
    return requestPromise
  }, [fetchCurrPhoto, fetchNextPhoto, fetchPrevPhoto])

  const preloadPhotoPage = useCallback((photoId) => {
    if (!photoId) {
      return
    }

    buildPhotoPage(photoId).catch(() => { })
  }, [buildPhotoPage])

  const load = useCallback(async ({ photoId }) => {
    const pageData = await buildPhotoPage(photoId)

    // A faster click may have moved us on; do not paint a stale page over it.
    if (activePhotoIdRef.current !== photoId) {
      return
    }

    if (pageData?.currPhoto == null) {
      // Failed fetch: keep any content already painted (bootstrapped or
      // cached); only fall through to NoMatch when nothing valid is on screen.
      setInternalState((prev) => (prev?.currPhoto != null
        ? prev
        : { currPhoto: null, nextPhoto: null, prevPhoto: null, requestComplete: true }))
      return
    }

    const calculatedDimensions = pageData?.dimensions || { width: 300, height: 300 }
    setDimensions(calculatedDimensions)

    setInternalState({
      currPhoto: pageData.currPhoto,
      nextPhoto: pageData.nextPhoto,
      prevPhoto: pageData.prevPhoto,
      requestComplete: true
    })

    preloadPhotoPage(pageData?.nextPhoto?.photo?.id)
    preloadPhotoPage(pageData?.prevPhoto?.photo?.id)
  }, [buildPhotoPage, preloadPhotoPage])

  useEffect(() => {
    if (photoId) {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
      }

      activePhotoIdRef.current = photoId

      // Paint immediately when data is already available. Blanking the state
      // first made even hover-preloaded prev/next navigations flash a skeleton.
      const cached = photoPageCache.current.get(photoId)
      const bootstrapped = bootstrapPhotoFromRouterState(location.state, photoId)
      setImageLoaded(false)

      if (cached) {
        setInternalState({
          currPhoto: cached.currPhoto,
          nextPhoto: cached.nextPhoto,
          prevPhoto: cached.prevPhoto,
          requestComplete: true
        })
        setDimensions(cached.dimensions || computeDisplayDimensions(cached.currPhoto?.photo))
      } else if (bootstrapped) {
        setInternalState({
          currPhoto: bootstrapped,
          nextPhoto: null,
          prevPhoto: null,
          requestComplete: false
        })
        setDimensions(computeDisplayDimensions(bootstrapped.photo))
        setImageLoaded(true)
      } else {
        setInternalState({
          currPhoto: null,
          nextPhoto: null,
          prevPhoto: null,
          requestComplete: false
        })
      }

      setShowVideoPlayer(false)
      setVideoReady(false)
      setVideoError(null)
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      load({ photoId })
    }
  }, [load, photoId, location.state])

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
              background: 'var(--bg-raised)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)'
            }}
            >
              <div style={{
                textAlign: 'center',
                marginBottom: '12px',
                padding: '6px 0',
                borderBottom: '2px solid rgba(124, 140, 248, 0.15)'
              }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  margin: '0',
                  color: 'var(--accent-light)'
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
                      background: 'rgba(124, 140, 248, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(124, 140, 248, 0.15)',
                      display: 'inline-block',
                      transition: 'all 0.3s ease',
                      boxShadow: 'none',
                      color: 'var(--text-secondary)'
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
              background: 'var(--bg-raised)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)'
            }}
            >
              <div style={{
                textAlign: 'center',
                marginBottom: '12px',
                padding: '6px 0',
                borderBottom: '2px solid rgba(248, 113, 113, 0.2)'
              }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  margin: '0',
                  color: '#f87171'
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
                      background: 'rgba(248, 113, 113, 0.1)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(248, 113, 113, 0.3)',
                      display: 'inline-block',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(248, 113, 113, 0.1)',
                      color: '#f87171'
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
            left: '10px',
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
            right: '10px',
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
            <meta property='og:site_name' content='WiSaw' />

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

            {/* ImageObject structured data for photos */}
            {currPhoto?.photo?.video !== true && (
              <script type='application/ld+json'>
                {JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'ImageObject',
                  name: finalVideoTitle,
                  description: finalVideoDescription,
                  contentUrl: currPhoto.photo.imgUrl,
                  thumbnailUrl: currPhoto.photo.thumbUrl,
                  url: `https://wisaw.com/photos/${currPhoto.photo.id}`,
                  datePublished: currPhoto.photo.createdAt || new Date().toISOString(),
                  width: parseInt(currPhoto.photo.width, 10) || 640,
                  height: parseInt(currPhoto.photo.height, 10) || 360,
                  encodingFormat: 'image/webp',
                  interactionStatistic: {
                    '@type': 'InteractionCounter',
                    interactionType: { '@type': 'ViewAction' },
                    userInteractionCount: parseInt(currPhoto.photo.watchersCount, 10) || 0
                  },
                  comment: currPhoto?.comments?.length > 0
                    ? { '@type': 'Comment', text: currPhoto.comments[0].comment }
                    : undefined,
                  publisher: {
                    '@type': 'Organization',
                    name: 'WiSaw',
                    url: 'https://wisaw.com',
                    logo: {
                      '@type': 'ImageObject',
                      url: 'https://wisaw.com/logo192.png'
                    }
                  }
                })}
              </script>
            )}

            {/* BreadcrumbList structured data */}
            <script type='application/ld+json'>
              {JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: 'https://wisaw.com'
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: currPhoto?.photo?.video === true ? 'Videos' : 'Photos',
                    item: 'https://wisaw.com'
                  },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: finalVideoTitle
                  }
                ]
              })}
            </script>
          </Helmet>

          {/* Reserve the label row height while a bootstrapped page hydrates */}
          <div
            className='recognition-tags'
            style={requestComplete
              ? undefined
              : { minHeight: 58, boxSizing: 'border-box' }}
          >
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
                  key={currPhoto.photo.id}
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
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
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

  // Cold load (deep link, no cache/router state): mirror the final page so
  // content fills reserved slots instead of swapping a different layout.
  if (!requestComplete || !currPhoto || !dimensions.width || !dimensions.height) {
    const placeholder = getPlaceholderDimensions()
    return (
      <div className='PhotosComponent'>
        <main className='content-container' role='main'>
          {/* Reserve the label row so media does not shift when labels hydrate */}
          <div
            className='recognition-tags'
            style={{ minHeight: 58, boxSizing: 'border-box' }}
          />

          {/* Media box at the final max display size (aspect ratio unknown) */}
          <div
            className='crop'
            style={{
              width: placeholder.width,
              height: placeholder.height,
              maxWidth: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div className='loading-spinner' aria-label='Loading media' />
          </div>

          {/* Reserve space for comments/recognition below the media */}
          <div style={{ height: 100, width: '100%' }} />
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
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
