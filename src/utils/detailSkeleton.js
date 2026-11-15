/**
 * One-shot capture of the detail-page skeleton that Lambda@Edge painted into #root.
 *
 * The edge serves a complete static layout for /photos/<id> and /videos/<id>: reserved header,
 * the media element at its natural size inside a fixed box, heading, description, labels and a
 * reserved below-fold space, with the interactive parts marked as enhancement slots. React mounts
 * into a sibling container (see src/index.js) so it never reconciles #root - the server-painted
 * media node is the LCP candidate and any detach at first-commit time would re-date its paint to
 * JS-delivery time, which is the failure this architecture removes. Capture must therefore happen
 * before the first commit; after that the nodes are gone from React's point of view anyway, and
 * the captured references keep them alive.
 *
 * The capture is deliberately strict: a skeleton only counts when it describes exactly the id the
 * route asked for and its media node carries numeric dimensions. Anything else (old edge still
 * cached, malformed output, non-detail route) yields null and the app renders fully client-side
 * as it always did - one honest check, no dual-format tolerance.
 */

const DETAIL_ROUTE = /^\/(photos|videos)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const MEDIA_ORIGIN = 'https://img.wisaw.com/'

let captured = null
let attempted = false
const listeners = new Set()

/**
 * Subscribe to the one-shot capture changing (it only ever goes object -> null, on handoff).
 * Consumers read it through useSyncExternalStore so a clear re-renders them - clearing is a
 * module mutation React cannot see on its own.
 */
export const subscribeDetailSkeleton = function (listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const positiveInt = (value) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export const captureDetailSkeleton = function () {
  if (attempted) {
    return captured
  }
  attempted = true

  try {
    const match = DETAIL_ROUTE.exec(window.location.pathname)
    if (!match) {
      return null
    }

    const root = document.getElementById('root')
    const mediaNode = root ? root.querySelector('[data-wisaw-media]') : null
    if (!mediaNode) {
      return null
    }

    // The skeleton describes one id. A route asking for a different one (stale edge output,
    // hand-typed URL) must not adopt someone else's media node.
    const skeletonId = (mediaNode.getAttribute('data-wisaw-id') || '').toLowerCase()
    if (skeletonId !== match[2].toLowerCase()) {
      return null
    }

    const width = positiveInt(mediaNode.getAttribute('width'))
    const height = positiveInt(mediaNode.getAttribute('height'))
    if (width == null || height == null) {
      return null
    }

    const isVideo = mediaNode.tagName === 'VIDEO'
    // A video page without its real object URL would render an empty source that errors over the
    // poster; a missing value means "nothing trustworthy to adopt".
    if (isVideo && !(mediaNode.getAttribute('src') || '')) {
      return null
    }

    const headerSlot = root.querySelector('[data-wisaw-slot="header"]')
    const belowSlot = root.querySelector('[data-wisaw-slot="below"]')
    // The enhancement layer portals into both slots; a skeleton missing either is not the format
    // this app adopts, so it renders fully client-side instead of half-enhancing.
    if (!headerSlot || !belowSlot) {
      return null
    }

    // Overlays (nav buttons, play button, spinner) portal into the media's fixed box — the media's
    // wrapper. If the media sits directly under #root there is no positioned box to overlay into,
    // and absolute-positioned UI would anchor to the page instead of the picture: not adoptable.
    const mediaBox = mediaNode.parentElement
    if (!mediaBox || mediaBox === root) {
      return null
    }

    captured = {
      kind: match[1].toLowerCase(),
      photoId: match[2].toLowerCase(),
      width,
      height,
      mediaNode,
      mediaBox,
      headerSlot,
      belowSlot
    }
  } catch {
    captured = null
  }

  return captured
}

export const getDetailSkeleton = function () {
  return captured
}

/** True while the route still shows the page the skeleton describes. */
export const skeletonMatchesPath = function (skeleton, pathname) {
  if (!skeleton || !pathname) {
    return false
  }
  const match = DETAIL_ROUTE.exec(pathname)
  return Boolean(match && match[1].toLowerCase() === skeleton.kind && match[2].toLowerCase() === skeleton.photoId)
}

/**
 * A currPhoto-shaped seed record for this route when the captured skeleton describes it - null
 * otherwise. Replaces the window.__wisawLcp-based seed: the dimensions and URLs come from the
 * node the browser actually painted, so React's first commit matches what is on screen by
 * construction. Unknown fields (duration, capture date) stay absent.
 */
export const skeletonSeededPhoto = function (photoId, kind) {
  if (!captured || String(captured.photoId) !== String(photoId ?? '')) {
    return null
  }
  if (kind != null && captured.kind !== kind) {
    return null
  }

  const isVideo = captured.kind === 'videos'
  return {
    photo: {
      id: captured.photoId,
      thumbUrl: `${MEDIA_ORIGIN}${captured.photoId}-thumb.webp`,
      imgUrl: `${MEDIA_ORIGIN}${captured.photoId}.webp`,
      video: isVideo,
      videoUrl: isVideo ? (captured.mediaNode.getAttribute('src') || '') : '',
      width: captured.width,
      height: captured.height
    },
    comments: [],
    recognitions: []
  }
}

/**
 * One-time handoff: the static frame is removed so the fully React-rendered page takes its place.
 * Called exactly once - on the first navigation away from the seeded page (prev/next or any other
 * route). After this, captured is null and every render path is the ordinary client-side one.
 */
export const clearDetailSkeleton = function () {
  if (!captured) {
    return
  }
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = ''
  }
  captured = null
  listeners.forEach((listener) => listener())
}

/** Test seam: forget any capture and re-arm, so a suite can simulate fresh boots. */
export const __resetDetailSkeletonForTests = function () {
  captured = null
  attempted = false
}
