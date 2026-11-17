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
  getActiveDetailFrame,
  paintClientDetailFrame,
  skeletonMatchesPath,
  skeletonSeededPhoto,
  subscribeDetailSkeleton
} from '../utils/detailSkeleton'
import { altTextFor } from '../utils/detailTemplate.generated'
import { fetchSeoText, getCachedSeoText, prefetchSeoText } from '../utils/detailSeoText'

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

/** Heading text for a record with no published wording — the same shape as the media's own alt fallback. */
export const fallbackDetailTitle = (photo) => `wisaw ${photo?.video === true ? 'video' : 'photo'} ${photo?.id ?? ''}`

/** Tag row of the frame: the sidecar's labels, else whatever this record's recognition carries. */
const frameLabelsFor = (currPhoto, seoText) => {
  if (seoText?.labels?.length) {
    return seoText.labels
  }
  return (parseRecognitionLabels(currPhoto?.recognitions?.[0]) ?? []).map((label) => label.Name)
}

/**
 * The inputs of the shared detail template (detailTemplate.generated.js `detailFrameHtml`) for one
 * record. Media comes from the record, wording from the sidecar the edge reads — with the record's
 * own labels and first comment standing in when a sidecar has not been generated.
 */
export const detailFrameParts = ({ photo, currPhoto, seoText, paintFullMedia = true }) => {
  const labels = frameLabelsFor(currPhoto, seoText)
  const title = seoText?.title || fallbackDetailTitle(photo)
  const description = seoText?.description || ''
  const caption = seoText?.imageCaption || currPhoto?.comments?.[0]?.comment || ''
  return {
    entityLabel: photo.video === true ? 'video' : 'photo',
    mediaId: photo.id,
    // The served markup always names the full-resolution object and lets the shell's swap script
    // demote it below the breakpoint; a page built here knows the viewport already, so it asks for
    // the thumbnail outright. Same element either way — the upgrade effect swaps its src once the
    // paint gate opens, exactly as it does on an edge-painted node.
    imageUrl: (photo.video === true || paintFullMedia) ? (photo.imgUrl || '') : (photo.thumbUrl || ''),
    previewUrl: photo.thumbUrl || '',
    videoUrl: photo.videoUrl || '',
    width: photo.width,
    height: photo.height,
    title,
    description,
    labels,
    altText: altTextFor({ caption, labels, description, title })
  }
}

/**
 * Label row shown on the loading placeholder while the record is still in flight. It mirrors the
 * DOM and box metrics of BelowMediaContent's recognitions row (same wrapper divs, same h1, pills with the
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

  // No display-size state: the media box is laid out by the shared detail template
  // (detailTemplate.generated.js `mediaBoxStyle`), which both the edge and this component paint from
  // the record's own width/height. Two sets of numbers is what let a navigated page size its picture
  // differently from the same photo loaded directly.
  const [seoText, setSeoText] = useState(() => getCachedSeoText(photoId))
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
    } else if (videoRef.current && !videoRef.current.paused) {
      // Stopping the player is React's call: rewind and let the next play re-report readiness. When
      // `showVideoPlayer` only went false because the adopted node was paused through its own
      // controls, resetting here would throw away the visitor's position — and clearing readiness
      // for a source that will not fire `loadeddata` again would leave the spinner over playback.
      setVideoReady(false)
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [showVideoPlayer])

  // Adopted mode: the <video> node is the one Lambda@Edge painted - React never renders it, so its
  // ref and media handlers are attached to that existing node here instead of through JSX. The
  // skeleton's own kind decides (not the record's claim): a video id requested under /photos/ is
  // served an <img> by the edge, and adopting it as a video would attach player state to an image.
  // Subscribed so a repaint or a handoff clear re-renders this component in or out of portal mode.
  const frame = useSyncExternalStore(subscribeDetailSkeleton, getActiveDetailFrame)
  const adopted = Boolean(
    frame &&
    skeletonMatchesPath(frame, location.pathname) &&
    // Case-insensitive like captureDetailSkeleton: the seed record carries the lower-cased id,
    // the route param keeps whatever case the URL had.
    String(internalState.currPhoto?.photo?.id ?? '').toLowerCase() === String(photoId ?? '').toLowerCase() &&
    (frame.kind === 'videos') === (internalState.currPhoto?.photo?.video === true)
  )

  useEffect(() => {
    if (!adopted || !frame || internalState.currPhoto?.photo?.video !== true) {
      return undefined
    }
    const node = frame.mediaNode
    videoRef.current = node
    // iOS plays inline only when told to; the edge owns this markup and older builds publish without
    // it, so set the attribute defensively (the client-rendered path carries playsInline in JSX).
    // Written as an attribute because that is what the platform reads at playback time.
    if (!node.hasAttribute('playsinline')) {
      node.setAttribute('playsinline', '')
    }
    const onLoadedData = () => {
      setVideoReady(true)
      setVideoError(null)
    }
    const onError = () => {
      setVideoReady(false)
      setVideoError('This video is unavailable right now.')
    }
    // The edge node carries its own native controls: a visitor pressing play or pause bypasses
    // React entirely, so the overlay must follow the element's real state or it would sit over a
    // playing video. No React-initiated load() here — playback belongs to the node's own controls.
    const onPlay = () => setShowVideoPlayer(true)
    const onPause = () => setShowVideoPlayer(false)
    node.addEventListener('loadeddata', onLoadedData)
    node.addEventListener('error', onError)
    node.addEventListener('play', onPlay)
    node.addEventListener('pause', onPause)
    return () => {
      node.removeEventListener('loadeddata', onLoadedData)
      node.removeEventListener('error', onError)
      node.removeEventListener('play', onPlay)
      node.removeEventListener('pause', onPause)
      if (videoRef.current === node) {
        videoRef.current = null
      }
    }
  },  [adopted, frame, internalState.currPhoto?.photo?.video])

  // Adopted photo: below the breakpoint the shell's swap script demoted the edge node to the
  // thumbnail, and while adopted React renders no <img> that could upgrade. When the input gate
  // opens, put the original on the painted node — the adopted twin of the src swap the
  // client-rendered path does on its single <img>. Above the breakpoint the gate starts open and
  // the node already carries this exact URL, so the write is a no-op there.
  useEffect(() => {
    if (!adopted || !frame) {
      return
    }
    const photo = internalState.currPhoto?.photo
    if (!paintFullMedia || !photo || photo.video === true || !photo.imgUrl) {
      return
    }
    const node = frame.mediaNode
    if (node.getAttribute('src') !== photo.imgUrl) {
      // This failure is ours to repair: the object that 404s is the original we are publishing, not
      // one the edge chose. Intercept it on the media box in the capture phase — which runs before
      // the edge's inline `onerror` regardless of registration order, and works even though error
      // events do not bubble — put the thumbnail back on the same node, and stop that marker from
      // firing: `.wsk-box--broken .wsk-media { visibility:hidden }` would hide a picture the
      // visitor can still see. A failure of anything else (the thumb itself, an object we never
      // pointed at) is left to the edge handler, which reserves the geometry and hides nothing.
      const box = node.parentElement
      const onSwapError = (event) => {
        if (event.target !== node || node.getAttribute('src') !== photo.imgUrl || !photo.thumbUrl) {
          return
        }
        event.stopPropagation()
        node.setAttribute('src', photo.thumbUrl)
      }
      box?.addEventListener('error', onSwapError, true)
      // The box may already be marked broken by an object the edge painted and we are replacing;
      // that verdict does not describe the source this write installs.
      box?.classList.remove('wsk-box--broken')
      node.setAttribute('src', photo.imgUrl)
      return () => { box?.removeEventListener('error', onSwapError, true) }
    }
  },  [adopted, frame, paintFullMedia, internalState.currPhoto?.photo])

  // The heading, description and tag row the edge shows are stored on the record's sitemap sidecar
  // (img.wisaw.com/<id>.json), not in GraphQL, so a page this component paints reads that same file.
  useEffect(() => {
    if (!photoId) {
      return undefined
    }
    setSeoText(getCachedSeoText(photoId))
    let alive = true
    fetchSeoText(photoId).then((text) => {
      if (alive) {
        setSeoText(text)
      }
    })
    return () => { alive = false }
  }, [photoId])

  // The neighbours' copy is warmed with their media, so prev/next paints from cache.
  useEffect(() => {
    prefetchSeoText([internalState.nextPhoto?.photo?.id, internalState.prevPhoto?.photo?.id])
  }, [internalState.nextPhoto, internalState.prevPhoto])

  // Every detail render the edge did not paint gets the edge's own page: the shared template is
  // painted into #root and this component portals its enhancements into it, exactly as it does into
  // the captured copy. That covers prev/next, local development, a stale edge cache, and a record
  // whose kind contradicts what the edge served (a video under /photos/, which the edge paints as an
  // <img> and this page must not leave half-enhanced).
  //
  // The wording usually arrives after the record does, and re-calling this with the same photo lets
  // the paint module update the frame's heading/description/tags in place instead of rebuilding it —
  // so the media node is never replaced behind a visitor who is already looking at it.
  useEffect(() => {
    const photo = internalState.currPhoto?.photo
    if (!photo) {
      // Settled "no such record": the picture must not stay up behind the NoMatch page. And while a
      // new id's record is still in flight, a frame showing somebody else's photo has to come down —
      // the URL moved, so the honest state is the loading placeholder, not the previous photo. A
      // cached hover-preload skips this branch entirely and repaints with no gap.
      if (frame && (internalState.currReady === true || !skeletonMatchesPath(frame, location.pathname))) {
        clearDetailSkeleton()
      }
      return
    }

    if (String(photo.id ?? '').toLowerCase() !== String(photoId ?? '').toLowerCase()) {
      return
    }

    // An edge-painted frame this page has adopted is never rebuilt: that media node carries the
    // page's LCP paint, and its wording is already the sidecar's, because the edge read the same file
    // when it served the page. A frame that cannot be adopted (wrong kind for the record) falls
    // through and gets replaced by a correct one.
    if (adopted && frame?.source === 'edge') {
      return
    }

    paintClientDetailFrame(detailFrameParts({ photo, currPhoto: internalState.currPhoto, seoText, paintFullMedia }))
  }, [frame, adopted, seoText, paintFullMedia, internalState.currPhoto, internalState.currReady, photoId, location.pathname])

  // Keep the tab title in step with a frame this app painted. An edge-painted page already carries
  // the same title in its served bytes — writing it again would be a <head> mutation on the adopted
  // route, which is pinned to stay at zero so nothing competes with what Lambda@Edge sent.
  useEffect(() => {
    const photo = internalState.currPhoto?.photo
    if (!photo || typeof document === 'undefined') {
      return
    }
    if (String(photo.id ?? '').toLowerCase() !== String(photoId ?? '').toLowerCase()) {
      return
    }
    if (adopted && frame?.source === 'edge') {
      return
    }
    document.title = seoText?.title || fallbackDetailTitle(photo)
  }, [frame, adopted, internalState.currPhoto, seoText, photoId, location.pathname])

  // The media box sizes itself from the record's own dimensions through the shared template, so a
  // viewport change needs no re-measure here. Widening past the breakpoint does need one thing: the
  // full-resolution source must not stay deferred forever on a visitor who resized onto a desktop.
  useEffect(() => {
    const handleResize = () => {
      if (!shouldDeferFullMedia()) {
        setPaintFullMedia(true)
        setWarmFullMedia(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleVideoPlayRequest = () => {
    setVideoError(null)
    setVideoReady(false)
    if (videoRef.current) {
      videoRef.current.load()
    }
    setShowVideoPlayer(true)
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
        prevPhoto: null
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
        prevPhoto: prev
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

      if (cached) {
        setInternalState({
          currPhoto: cached.currPhoto,
          nextPhoto: cached.nextPhoto,
          prevPhoto: cached.prevPhoto,
          currReady: true,
          requestComplete: true
        })
      } else if (bootstrapped) {
        setInternalState({
          currPhoto: bootstrapped,
          nextPhoto: null,
          prevPhoto: null,
          currReady: true,
          requestComplete: false
        })
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
  // container. Render just the enhancement layer - nav buttons into the page column (the same box
  // <main class="content-container"> is in the client-rendered path, so they do not move at handoff),
  // video overlays into the media box they centre on, comments/recognitions/footer into the below
  // slot - via portals, so the LCP <img>/<video> is never mounted, cloned or touched by React. The
  // static frame (h1/description/labels) stays server-owned.
  if ( adopted && frame && currPhoto?.photo) {
    const isVideo = currPhoto.photo.video === true

    return (
      <>
        <Suspense fallback={null}>
          {createPortal(renderNavigationButtons(), frame.navContainer)}
          {isVideo && createPortal(
            <VideoOverlays showVideoPlayer={showVideoPlayer} videoReady={videoReady} videoError={videoError} onPlayRequest={handleVideoPlayRequest} />,
            frame.mediaBox
          )}
        </Suspense>
        <Suspense fallback={null}>
          {frame.belowSlot && createPortal(
            <BelowMediaContent currPhoto={currPhoto} renderRecognitions={renderRecognitions} />,
            frame.belowSlot
          )}
        </Suspense>
        <Suspense fallback={null}>
          {frame.belowSlot && createPortal(<Footer />, frame.belowSlot)}
        </Suspense>
      </>
    )
  }

  // A record this component has to paint a frame for: the paint effect does it in #root right after
  // this commit, so React renders nothing of its own here. Anything it could render — a card, a
  // spinner box — would be a second template for the same page, which is what this file used to do
  // on every prev/next navigation.
  if (currPhoto?.photo) {
    return null
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

  // Nothing to paint yet (deep link with no cache/router state, or a prev/next whose record is still
  // in flight on a page the edge did not paint): reserve the boxes so the frame that replaces this
  // cannot shift the page. This paints no heading, description or labels — it is a placeholder, not
  // a second version of the page.
  if (!currReady || !currPhoto) {
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

  // Every state above covers a detail route; there is no fifth one.
  return null
}

export default PhotosComponent
