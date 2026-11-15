/* eslint-disable react/react-in-jsx-scope */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

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
import {
  COLD_BELOW_MEDIA_RESERVE,
  PLACEHOLDER_LABEL_COUNT,
  computeDisplayDimensions,
  getPlaceholderDimensions
} from '../utils/detailLayout'
import {
  FULL_MEDIA_WARM_DELAY_MS,
  hasFirstInputHappened,
  scheduleAfterWindowLoad,
  shouldDeferFullMedia
} from '../utils/mediaUpgrade'
import {
  clearDetailSkeleton,
  getDetailSkeleton,
  skeletonMatchesPath,
  skeletonSeededPhoto,
  subscribeDetailSkeleton
} from '../utils/detailSkeleton'

const Footer = lazy(() => import('./Footer'))

// The path a media item was asked for, not the kind its record claims: /photos/<id> and
// /videos/<id> both mount this page. (Detail-route head tags are gone with them - the edge's
// served bytes are authoritative - so only the seed derivation still needs this.)
const segmentFromPath = function (pathname = '') {
  const match = String(pathname).match(/^\/(photos|videos)\//)
  return match ? match[1] : undefined
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

/** Recognition labels of one record, or null when absent, malformed or unparseable. */
const parseRecognitionLabels = (recognition) => {
  if (!recognition?.metaData) return null
  try {
    const labels = JSON.parse(recognition.metaData)?.Labels
    if (!Array.isArray(labels)) return null
    // Only fully renderable labels count: the same list decides both the row's
    // content and whether the slot stays transparent, so a half-broken record
    // cannot crash render nor paint an empty panel.
    return labels.filter((label) => typeof label?.Name === 'string' && label.Name.length > 0)
  } catch (err) {
    console.error('Error parsing recognition metadata:', err.message)
    return null
  }
}

/**
 * Label row shown while recognitions are still in flight. It mirrors the DOM and
 * box metrics of renderLabelRow's output (same wrapper divs, same h1, pills with the
 * same padding/border/margins), so swapping real labels in cannot move the media box
 * below it — a magic min-height always disagreed with the hydrated height by tens of
 * pixels and pushed the whole page down on hydration. The pills carry no text: the
 * row is clamped to one line, so width is irrelevant to its height and a crawler is
 * never served a heading made of filler words.
 */
const RecognitionLabelsSkeleton = () => (
  <div>
    <div style={{ margin: '4px 0 8px' }}>
      <h1 className='recognition-tags-h1 skeleton-pill-row' aria-hidden='true'>
        {Array.from({ length: PLACEHOLDER_LABEL_COUNT }, (_, i) => (
          <span key={i} className='skeleton-pill' />
        ))}
      </h1>
    </div>
  </div>
)

/**
 * First-comment row reserved while comments are unknown, sized like the hydrated
 * `<p className='comment-text' style={{ fontSize: 24, fontWeight: 600 }}>`. It stays
 * mounted (transparent) once we know a photo has no comments, so the slot height is
 * the same in every state and cannot move what sits below it. Longer comments only
 * move content below the fold.
 */
const CommentSlotSkeleton = () => (
  <div className='comments-section comments-section--slot'>
    <div>
      <p
        className='comment-text skeleton-comment'
        style={{ fontSize: 24, fontWeight: 600 }}
        aria-hidden='true'
      >
        &nbsp;
      </p>
    </div>
  </div>
)

/**
 * The play button, loading spinner and error alert layered over a video. Rendered inside the
 * media box in both render paths - portaled into the edge-painted box in adopted mode, inline in
 * the fully client-rendered page - so the two can never drift apart.
 */
const VideoOverlays = ({ showVideoPlayer, videoReady, videoError, onPlayRequest }) => (
  <>
    {!showVideoPlayer && (
      <div
        onClick={onPlayRequest}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onPlayRequest()
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
  </>
)

/**
 * Everything below the media box: comments (or the reserved slot), recognitions and a small
 * spacer. Shared by both render paths so adopted and client-rendered pages lay out identically.
 */
const BelowMediaContent = ({ currPhoto, renderRecognitions }) => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    {currPhoto.comments?.length > 0 ? (
      <div className='comments-section'>
        {currPhoto.comments.map((comment, i) => (
          <div key={comment.id}>
            {i === 0 && (
              <p
                className='comment-text'
                style={{ fontSize: 24, fontWeight: 600 }}
              >
                {comment.comment}
              </p>
            )}
            {i > 0 && (
              <p
                className='comment-text'
                style={{ fontSize: 18, fontWeight: 400 }}
              >
                {comment.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    ) : <CommentSlotSkeleton />}
    <div className='recognition-tags'>
      {currPhoto.recognitions && renderRecognitions(currPhoto?.recognitions[0])}
    </div>
    <div style={{ margin: '6px', align: 'center' }} />
  </div>
)

const PhotosComponent = function () {
  const { photoId } = useParams()
  const location = useLocation()

  // Feed cards pass their record via router state; when it matches this route
  // we can paint the real media before any GraphQL response arrives.
  const bootstrappedPhoto = bootstrapPhotoFromRouterState(location.state, photoId)

  // Deep links get nothing from the feed, but Lambda@Edge already painted this page's media into
  // #root (captured once in index.js). Seeding from that node keeps React's first commit matching
  // what is on screen by construction - the edge copy is preloaded and usually already decoded.
  const routeKind = segmentFromPath(location.pathname)
  const skeletonSeeded = skeletonSeededPhoto(photoId, routeKind)

  // currReady flips when the current record's own answer is in (or bootstrap/cache painted it);
  // requestComplete waits for the neighbours too. The LCP paint must not wait for them.
  const [internalState, setInternalState] = useState(() => ({
    currPhoto: bootstrappedPhoto ?? skeletonSeeded,
    nextPhoto: null,
    prevPhoto: null,
    currReady: bootstrappedPhoto != null || skeletonSeeded != null,
    requestComplete: false
  }))

  const [dimensions, setDimensions] = useState(() => {
    if (bootstrappedPhoto) {
      return computeDisplayDimensions(bootstrappedPhoto.photo)
    }
    if (skeletonSeeded) {
      return computeDisplayDimensions(skeletonSeeded.photo)
    }
    return { width: null, height: null }
  })
  // A bootstrapped photo is already decoded (the feed card just displayed its
  // thumbnail), so paint it immediately instead of hiding it behind a spinner. An edge-seeded one
  // was painted by the browser before React existed, but this element is a fresh node - start it
  // hidden and let its own load event fade it in (it is preloaded, so that is usually instant).
  const [imageLoaded, setImageLoaded] = useState(bootstrappedPhoto != null)
  // The original is multi-megabyte, so on phones its bytes are warmed in the background and only
  // painted once the visitor interacts - that paint would otherwise become the LCP candidate. A
  // visitor who already interacted before this lazy chunk loaded froze LCP too, and nothing else
  // can tell us about that input, so both gates open at once for them.
  const [paintFullMedia, setPaintFullMedia] = useState(() => !shouldDeferFullMedia() || hasFirstInputHappened())
  const [warmFullMedia, setWarmFullMedia] = useState(() => !shouldDeferFullMedia() || hasFirstInputHappened())
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(null)

  const videoRef = useRef(null)

  const loadedMedia = useRef(new Set())
  const inflightMediaPreloads = useRef(new Map())
  const photoPageCache = useRef(new Map())
  const inflightCurrRequests = useRef(new Map())
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
    if (internalState.currReady && internalState.currPhoto) {
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

  // First input freezes LCP, so from then on the sharp image is free to paint. Opening both gates
  // together also covers someone who interacts before the background warm was due. The single media
  // <img> swaps its src at that moment; claiming the original is loaded too would raster it inside
  // this input's frame - and this input is what INP measures.
  useEffect(() => {
    if (paintFullMedia && warmFullMedia) {
      return
    }

    const upgrade = () => {
      setPaintFullMedia(true)
      setWarmFullMedia(true)
      setImageLoaded(false)
    }
    const options = { once: true, passive: true }
    window.addEventListener('pointerdown', upgrade, options)
    window.addEventListener('keydown', upgrade, options)
    window.addEventListener('wheel', upgrade, options)

    return () => {
      window.removeEventListener('pointerdown', upgrade)
      window.removeEventListener('keydown', upgrade)
      window.removeEventListener('wheel', upgrade)
    }
  }, [paintFullMedia, warmFullMedia])

  // The background pull the page asks for: a few seconds after loading finishes, fetch the original
  // without touching the DOM. The preload effect below is what issues the request.
  useEffect(() => {
    if (warmFullMedia) {
      return
    }
    return scheduleAfterWindowLoad(FULL_MEDIA_WARM_DELAY_MS, () => setWarmFullMedia(true))
  }, [warmFullMedia])

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

      // Below the breakpoint the original waits for the warm gate; above it this is unchanged.
      if (entry.photo.video !== true && warmFullMedia) {
        preloadImage(entry.photo.imgUrl)
      }
    })
  }, [internalState.currPhoto, internalState.nextPhoto, internalState.prevPhoto, preloadImage, warmFullMedia])

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

  // Adopted mode: the <video> node is the one Lambda@Edge painted - React never renders it, so its
  // ref and media handlers are attached to that existing node here instead of through JSX. The
  // skeleton's own kind decides (not the record's claim): a video id requested under /photos/ is
  // served an <img> by the edge, and adopting it as a video would attach player state to an image.
  // Subscribed so a handoff clear re-renders this component out of adopted mode.
  const skeleton = useSyncExternalStore(subscribeDetailSkeleton, getDetailSkeleton)
  const adopted = Boolean(
    skeleton &&
    skeletonMatchesPath(skeleton, location.pathname) &&
    internalState.currPhoto?.photo?.id == photoId &&
    (skeleton.kind === 'videos') === (internalState.currPhoto?.photo?.video === true)
  )

  useEffect(() => {
    if (!adopted || !skeleton || internalState.currPhoto?.photo?.video !== true) {
      return undefined
    }
    const node = skeleton.mediaNode
    videoRef.current = node
    const onLoadedData = () => {
      setVideoReady(true)
      setVideoError(null)
    }
    const onError = () => {
      setVideoReady(false)
      setVideoError('This video is unavailable right now.')
    }
    node.addEventListener('loadeddata', onLoadedData)
    node.addEventListener('error', onError)
    return () => {
      node.removeEventListener('loadeddata', onLoadedData)
      node.removeEventListener('error', onError)
      if (videoRef.current === node) {
        videoRef.current = null
      }
    }
  }, [adopted, skeleton, internalState.currPhoto?.photo?.video])

  // Hand #root back to React once the skeleton stops describing what is on screen: either the
  // route moved off it (first prev/next navigation) or this page stopped adopting it (a record
  // whose kind disagrees with the edge's - e.g. a video id under /photos/ - would otherwise leave
  // the static frame and the full React page stacked). AppShell clears on route change too; both
  // calls are idempotent.
  useEffect(() => {
    if (!skeleton) {
      return
    }
    const onSkeletonPage = skeletonMatchesPath(skeleton, location.pathname)
    if (!onSkeletonPage || !adopted) {
      clearDetailSkeleton()
    }
  }, [skeleton, location.pathname, adopted])

  useEffect(() => {
    const handleResize = () => {
      if (internalState.currPhoto?.photo) {
        setDimensions(computeDisplayDimensions(internalState.currPhoto.photo))
      }
      // Widening past the breakpoint must not leave a visitor stuck on the small source.
      if (!shouldDeferFullMedia()) {
        setPaintFullMedia(true)
        setWarmFullMedia(true)
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
                  duration
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
                  duration
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
                  duration
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

  // The current record is the only thing the page needs to paint, so give its query one shared,
  // deduped promise: load() paints on it and buildPhotoPage's curr leg reuses it, which keeps a
  // cold deep link from issuing getPhotoAllCurr twice.
  const fetchCurrPhotoOnce = useCallback((photoId) => {
    const existing = inflightCurrRequests.current.get(photoId)
    if (existing) {
      return existing
    }

    const requestPromise = fetchCurrPhoto({ photoId }).finally(() => {
      inflightCurrRequests.current.delete(photoId)
    })
    inflightCurrRequests.current.set(photoId, requestPromise)
    return requestPromise
  }, [fetchCurrPhoto])

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
        fetchCurrPhotoOnce(photoId),
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
  }, [fetchCurrPhotoOnce, fetchNextPhoto, fetchPrevPhoto])

  const preloadPhotoPage = useCallback((photoId) => {
    if (!photoId) {
      return
    }

    // A cached page is a plain object, not a promise - normalize before attaching the swallow.
    Promise.resolve(buildPhotoPage(photoId)).catch(() => { })
  }, [buildPhotoPage])

  // Paint the moment the current record settles (or keep what is on screen when its fetch failed);
  // a slow neighbour query must never hold the LCP media hostage.
  const paintCurrentPhoto = useCallback((curr) => {
    if (curr == null) {
      // Failed fetch: keep any content already painted (bootstrapped or cached); only fall
      // through to NoMatch when nothing valid is on screen.
      setInternalState((prev) => ({ ...prev, currReady: true }))
      return
    }

    setDimensions(computeDisplayDimensions(curr.photo))
    setInternalState((prev) => ({ ...prev, currPhoto: curr, currReady: true }))
  }, [])

  const load = useCallback(({ photoId }) => {
    const cachedPage = photoPageCache.current.get(photoId)
    const currPromise = cachedPage
      ? Promise.resolve(cachedPage.currPhoto)
      : fetchCurrPhotoOnce(photoId)

    currPromise.then((curr) => {
      // A faster click may have moved us on; do not paint a stale page over it.
      if (activePhotoIdRef.current !== photoId) {
        return
      }
      paintCurrentPhoto(curr)
    })

    // Next/prev power the navigation buttons and preloads; they fill in behind the first paint.
    Promise.resolve(buildPhotoPage(photoId)).then((pageData) => {
      if (activePhotoIdRef.current !== photoId) {
        return
      }
      setInternalState((prev) => ({
        currPhoto: pageData.currPhoto ?? prev.currPhoto,
        nextPhoto: pageData.nextPhoto,
        prevPhoto: pageData.prevPhoto,
        currReady: true,
        requestComplete: true
      }))
      preloadPhotoPage(pageData?.nextPhoto?.photo?.id)
      preloadPhotoPage(pageData?.prevPhoto?.photo?.id)
    })
  }, [buildPhotoPage, fetchCurrPhotoOnce, paintCurrentPhoto, preloadPhotoPage])

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
      // The captured skeleton (index.js) already painted this media before React existed; seed from
      // its node so the first commit matches what is on screen instead of a skeleton.
      const seeded = skeletonSeededPhoto(photoId, routeKind)
      setImageLoaded(false)

      if (cached) {
        setInternalState({
          currPhoto: cached.currPhoto,
          nextPhoto: cached.nextPhoto,
          prevPhoto: cached.prevPhoto,
          currReady: true,
          requestComplete: true
        })
        setDimensions(cached.dimensions || computeDisplayDimensions(cached.currPhoto?.photo))
      } else if (bootstrapped) {
        setInternalState({
          currPhoto: bootstrapped,
          nextPhoto: null,
          prevPhoto: null,
          currReady: true,
          requestComplete: false
        })
        setDimensions(computeDisplayDimensions(bootstrapped.photo))
        // Above the breakpoint the thumb was already replaced, so stay opaque. Below it this record's
        // original has never been painted, so let it fade in once decoded instead of rastering now.
        setImageLoaded(!shouldDeferFullMedia())
      } else if (seeded) {
        // The edge already painted this media before React existed: keep the same box on screen
        // while getPhotoAllCurr hydrates comments/recognitions over it, instead of a skeleton.
        setInternalState({
          currPhoto: seeded,
          nextPhoto: null,
          prevPhoto: null,
          currReady: true,
          requestComplete: false
        })
        setDimensions(computeDisplayDimensions(seeded.photo))
        setImageLoaded(false)
      } else {
        setInternalState({
          currPhoto: null,
          nextPhoto: null,
          prevPhoto: null,
          currReady: false,
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
  }, [load, photoId, location.state, routeKind])

  const recognitionsLabels = (recognition, lebelsToInclude = 10) => {
    if (!recognition) return ''
    try {
      return JSON.parse(recognition.metaData)?.Labels?.slice(0, lebelsToInclude).map((label) => label.Name).join(', ')
    } catch (err) {
      console.error('Error parsing recognition data:', err.message)
      return ''
    }
  }

  const renderLabelRow = (labels) => (
    <div>
      <div style={{ margin: '4px 0 8px' }}>
        <h1 className='recognition-tags-h1'>
          {labels.slice(0, PLACEHOLDER_LABEL_COUNT).map((label) => (
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
    </div>
  )

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

  const { currPhoto, currReady } = internalState

  // Adopted mode: the server painted this exact media node into #root and React owns only a sibling
  // container. Render just the enhancement layer - nav buttons + video overlays into the media box,
  // comments/recognitions/footer into the below slot - via portals, so the LCP <img>/<video> is never
  // mounted, cloned or touched by React. The static frame (h1/description/labels) stays server-owned.
  if (adopted && skeleton && currPhoto?.photo) {
    const isVideo = currPhoto.photo.video === true

    return (
      <>
        <Suspense fallback={null}>
          {createPortal(
            <>
              {renderNavigationButtons()}
              {isVideo && <VideoOverlays showVideoPlayer={showVideoPlayer} videoReady={videoReady} videoError={videoError} onPlayRequest={handleVideoPlayRequest} />}
            </>,
            skeleton.mediaBox
          )}
        </Suspense>
        <Suspense fallback={null}>
          {skeleton.belowSlot && createPortal(
            <BelowMediaContent currPhoto={currPhoto} renderRecognitions={renderRecognitions} />,
            skeleton.belowSlot
          )}
        </Suspense>
        <Suspense fallback={null}>
          {skeleton.belowSlot && createPortal(<Footer />, skeleton.belowSlot)}
        </Suspense>
      </>
    )
  }

  if (currPhoto && currPhoto?.photo && dimensions.width && dimensions.height) {
    const isVideo = currPhoto.photo.video === true
    // A short label for the player's own accessibility text; the page title carries the brand.
    const videoLabel = recognitionsLabels(currPhoto?.recognitions[0], 3) || 'WiSaw video'
    const detailLabels = parseRecognitionLabels(currPhoto.recognitions?.[0])
    const hasDetailLabels = detailLabels?.length > 0

    return (
      <div className='PhotosComponent'>
        {/* Main article/video content wrapper to establish this as a watch page */}
        <main className='content-container' role='main' style={{ position: 'relative' }}>
          {/* Navigation buttons in upper corners */}
          {renderNavigationButtons()}

          {/*
            Label row above the media. Its box is kept in every state - loading,
            labeled, or confirmed label-free (transparent slot) - because the media
            panel below it is already painted and would ride any height change.
          */}
          <div
            className={hasDetailLabels
              ? 'recognition-tags'
              : 'recognition-tags recognition-tags--slot'}
          >
            {hasDetailLabels
              ? renderLabelRow(detailLabels)
              : <RecognitionLabelsSkeleton />}
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
            {isVideo && (
              <>
                {/* Thumbnail as base layer for videos - always visible */}
                <img
                  width={`${dimensions.width}`}
                  height={`${dimensions.height}`}
                  className='thumbnailImage'
                  src={currPhoto.photo.thumbUrl}
                  decoding='async'
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
                <VideoOverlays showVideoPlayer={showVideoPlayer} videoReady={videoReady} videoError={videoError} onPlayRequest={handleVideoPlayRequest} />

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
                  aria-label={videoLabel}
                  onLoadedData={handleVideoLoadedData}
                  onPlay={handleVideoLoadedData}
                  onError={handleVideoError}
                >
                  <source src={currPhoto.photo.videoUrl} type='video/mp4' />
                  Your browser does not support the video tag.
                </video>
              </>
            )}

            {isVideo !== true && (
              // One media node: thumb below the breakpoint until first input, full-res above it or
              // after interaction - the upgrade is a src swap on this same element, so nothing
              // re-lays-out and the painted LCP candidate is never replaced by a second node.
              <img
                key={currPhoto.photo.id}
                width={`${dimensions.width}`}
                height={`${dimensions.height}`}
                className='mainImage'
                src={paintFullMedia ? currPhoto.photo.imgUrl : currPhoto.photo.thumbUrl}
                fetchPriority='high'
                decoding='async'
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
            )}
          </div>
          <BelowMediaContent currPhoto={currPhoto} renderRecognitions={renderRecognitions} />
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    )
  }

  if (currReady === true && (currPhoto === null || currPhoto?.photo === null)) {
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
  if (!currReady || !currPhoto || !dimensions.width || !dimensions.height) {
    const placeholder = getPlaceholderDimensions()
    return (
      <div className='PhotosComponent'>
        <main className='content-container' role='main'>
          {/* Exact-height label row: the media box top never moves on hydration */}
          <div className='recognition-tags recognition-tags--slot'>
            <RecognitionLabelsSkeleton />
          </div>

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

          {/*
            Unpainted filler: nothing below the media is painted yet, so the aspect
            ratio arriving cannot move visible content. The Footer is deliberately
            absent here for the same reason - rendering it made it ride a ~300px
            jump when the square placeholder resolved to the real aspect ratio.
          */}
          <div style={{ height: COLD_BELOW_MEDIA_RESERVE, width: '100%' }} />
        </main>
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
