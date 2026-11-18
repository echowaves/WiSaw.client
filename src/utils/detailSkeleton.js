/**
 * The detail page's frame, whoever painted it.
 *
 * Two producers fill one store:
 *
 * - `captureDetailSkeleton` adopts the complete static layout Lambda@Edge served for
 *   /photos/<id> and /videos/<id>: reserved header, the media element at its natural size inside a
 *   fixed box, heading, description, labels and reserved below-fold space, with the interactive
 *   parts marked as enhancement slots. React mounts into a sibling container (see src/index.js) so
 *   it never reconciles #root - the server-painted media node is the LCP candidate and any detach at
 *   first-commit time would re-date its paint to JS-delivery time, which is the failure this
 *   architecture removes. Capture must therefore happen before the first commit; after that the
 *   nodes are gone from React's point of view anyway, and the captured references keep them alive.
*   The capture is deliberately strict: a frame only counts when it describes exactly the id the
 *   route asked for and its media node carries numeric dimensions. Anything else (old edge still
 *   cached, malformed output, non-detail route) yields null and the app paints the page itself.
 *
 * - `paintClientDetailFrame` renders the very same template - the module the edge's body is built
 *   from, published into this repository verbatim (src/utils/detailTemplate.generated.js) - for a
 *   detail render the edge did not paint: after prev/next, in local development, or on a stale edge
 *   cache. It goes through the same store and hands back the same node references, so every piece
 *   of enhancement (nav buttons, video overlays, comments, footer, Header) portals identically and
 *   one photo cannot look like two different pages depending on how the visitor arrived.
 */

import { detailFrameHtml, SKELETON_STYLE } from './detailTemplate.generated'

const DETAIL_ROUTE = /^\/(photos|videos)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

let captured = null
let painted = null
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

    const nodes = collectFrameNodes(root, mediaNode)
    if (!nodes) {
      return null
    }

    captured = {
      source: 'edge',
      kind: match[1].toLowerCase(),
      photoId: match[2].toLowerCase(),
      width,
      height,
      mediaNode,
      ...nodes
    }
  } catch {
    captured = null
  }

  return captured
}

/**
 * The node references the enhancement layer portals into, found on a frame that is already in the
 * DOM — the edge's copy or one this module painted. Returns null when the frame is not shaped the
 * way the enhancement layer needs.
 */
function collectFrameNodes (host, mediaNode) {
  const headerSlot = host.querySelector('[data-wisaw-slot="header"]')
  const belowSlot = host.querySelector('[data-wisaw-slot="below"]')
  // The enhancement layer portals into both slots; a frame missing either is not the format this app
  // enhances, so it declines the page instead of half-enhancing it.
  if (!headerSlot || !belowSlot) {
    return null
  }

  // Media-centred overlays (play button, spinner, error alert) portal into the media's fixed box —
  // the media's wrapper. If the media sits directly under the mount point there is no positioned box
  // to overlay into, and absolute-positioned UI would anchor to the page instead of the picture: not
  // adoptable.
  const mediaBox = mediaNode.parentElement
  if (!mediaBox || mediaBox === host) {
    return null
  }

  // Nav buttons anchor to the column that holds the media box, never to the box itself: in the
  // fully client-rendered path they anchor to <main class="content-container">, and any other box
  // makes them visibly jump at the one-time handoff. Found structurally rather than by class name —
  // the template owns those names (WiSaw.cdk skeleton.js) and a rename must not silently break
  // adoption. A column that is the mount point itself (media wrapped exactly once) keeps using the
  // media box: anchoring UI to #root would be worse than the jump it avoids.
  const column = mediaBox.parentElement && mediaBox.parentElement !== host
    ? mediaBox.parentElement
    : mediaBox
  // The column is made a positioning context only when nothing already positions it:
  // `position:relative` with no offsets cannot shift layout or create a stacking context, so this
  // costs neither LCP nor CLS, and the guard never overwrites a rule the template itself carries.
  const columnPosition = window.getComputedStyle(column).position
  if (!columnPosition || columnPosition === 'static') {
    column.style.position = 'relative'
  }
  // Portals append, and the column's last child is the below-fold slot — so portalling straight into
  // the column would put prev/next after the comments and footer in DOM order, i.e. last in tab
  // order on a keyboard tour (they are first inside <main> once the page is client-rendered). The
  // anchor is therefore an empty out-of-flow node inserted ahead of the media box: it holds no box
  // of its own (absolute, full column width), so nav's existing offsets resolve against exactly the
  // column padding box they would have, and nothing about the painted layout changes.
  const navContainer = document.createElement('div')
  navContainer.setAttribute('data-wisaw-nav', '')
  navContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%'
  column.insertBefore(navContainer, column.firstChild)

  return { mediaBox, navContainer, headerSlot, belowSlot }
}

/** The frame the browser is showing for a detail route, from either producer. */
export const getActiveDetailFrame = function () {
  return captured || painted
}

const FRAME_STYLE_ID = 'wisaw-frame-style'

// The edge ships the frame stylesheet inside the body it serves; a page React paints has never
// seen that body, so the same string is inserted once here. It goes in <head> rather than beside the
// frame so repainting a photo cannot churn a copy of it per navigation.
function ensureFrameStyle (doc) {
  if (doc.getElementById(FRAME_STYLE_ID)) {
    return
  }
  const style = doc.createElement('style')
  style.id = FRAME_STYLE_ID
  style.textContent = SKELETON_STYLE.replace(/^<style>/, '').replace(/<\/style>$/, '')
  doc.head.appendChild(style)
}

/**
 * Replace the wording nodes of an already-painted frame — heading, description, tag row, home link —
 * with what the same template builds now. Found structurally (the nodes between the media box and the
 * below slot) rather than by class name, and the media node is never touched: it is the LCP candidate
 * of this paint and, for a video, the element that may be mid-playback.
 *
 * Returns false when the live frame is not shaped as expected, in which case the caller does a full
 * repaint instead.
 */
function refreshFrameText (host, parts) {
  const media = host.querySelector('[data-wisaw-media]')
  const box = media?.parentElement
  const belowSlot = host.querySelector('[data-wisaw-slot="below"]')
  if (!box || !belowSlot || box.parentElement !== belowSlot.parentElement) {
    return false
  }

  const next = document.createElement('div')
  next.innerHTML = detailFrameHtml({ ...parts, withStyle: false })
  const nextBox = next.querySelector('[data-wisaw-media]')?.parentElement
  const nextBelowSlot = next.querySelector('[data-wisaw-slot="below"]')
  if (!nextBox || !nextBelowSlot) {
    return false
  }

  const incoming = []
  for (let node = nextBox.nextSibling; node && node !== nextBelowSlot; node = node.nextSibling) {
    incoming.push(node)
  }

  let outgoing = box.nextSibling
  while (outgoing && outgoing !== belowSlot) {
    const nextSibling = outgoing.nextSibling
    outgoing.remove()
    outgoing = nextSibling
  }
  for (const node of incoming) {
    belowSlot.parentElement.insertBefore(node, belowSlot)
  }

  // The picture's description is wording too — the edge writes it once, at serve time. Comments
  // arrive after a client paint, so this is where they become the alt text.
  const altText = String(parts.altText ?? '')
  if (altText && media.tagName === 'IMG' && media.getAttribute('alt') !== altText) {
    media.setAttribute('alt', altText)
  }
  return true
}

/**
 * Paint the shared detail template into #root for a record the edge did not paint, and publish it
 * through this store so the enhancement layer portals into it exactly as it does into the edge's.
 *
 * Replaces whatever frame is there now (the edge's copy of the previous photo, or a previous client
 * paint) in one step, then notifies: listeners see one transition, never an empty #root between two
 * photos. `parts` are the template's own inputs — see detailTemplate.generated.js.
 */
export const paintClientDetailFrame = function (parts = {}) {
  if (typeof document === 'undefined') {
    return null
  }
  const host = document.getElementById('root')
  const photoId = String(parts.mediaId ?? '').toLowerCase()
  if (!host || !photoId) {
    return null
  }

  const kind = parts.entityLabel === 'video' ? 'videos' : 'photos'

  // The frame for this record is already up: the wording sidecar arrived after it was painted. Put
  // the new heading/description/tags in place and leave the media node alone — replacing it would
  // re-decode the picture (a visible blink) and restart any video that had started playing.
  if (painted && painted.photoId === photoId && painted.kind === kind && refreshFrameText(host, parts)) {
    return painted
  }

  host.innerHTML = ''
  captured = null
  painted = null
  ensureFrameStyle(document)
  host.insertAdjacentHTML('afterbegin', detailFrameHtml({ ...parts, withStyle: false }))

  const mediaNode = host.querySelector('[data-wisaw-media]')
  if (!mediaNode) {
    return null
  }
  const nodes = collectFrameNodes(host, mediaNode)
  if (!nodes) {
    return null
  }

  painted = { source: 'client', kind, photoId, mediaNode, ...nodes }
  listeners.forEach((listener) => listener())
  return painted
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

/** True for any photo/video detail route, whatever id it asks for. */
export const isDetailPath = function (pathname) {
  return Boolean(DETAIL_ROUTE.exec(String(pathname || '')))
}

const ABSOLUTE_URL = /^https:\/\/[^\s"']+$/i

/**
 * The media object URLs the edge published on the skeleton node, or null when it published none.
 * Absent is a real state — an older edge build still answers some origins — and the answer is to seed
 * nothing rather than to guess: rebuilding the URL here would put the naming rule back in this file,
 * which is the one thing this module exists not to do.
 */
const publishedUrls = function (mediaNode) {
  const src = mediaNode.getAttribute('data-wisaw-src') || ''
  const thumb = mediaNode.getAttribute('data-wisaw-thumb') || ''
  if (!ABSOLUTE_URL.test(src) || !ABSOLUTE_URL.test(thumb)) return null
  return { src, thumb }
}

/**
 * A currPhoto-shaped seed record for this route when the captured skeleton describes it - null
 * otherwise. Replaces the window.__wisawLcp-based seed: the dimensions and URLs come from the
 * node the browser actually painted, so React's first commit matches what is on screen by
 * construction. Unknown fields (duration, capture date) stay absent.
 */
export const skeletonSeededPhoto = function (photoId, kind) {
  // captured.photoId is stored lower-cased; the route param can arrive in any case, and capture
  // already matched it case-insensitively — a strict compare here would reject the very skeleton
  // capture just adopted and hand #root back, destroying the painted node on uppercase URLs.
  if (!captured || captured.photoId !== String(photoId ?? '').toLowerCase()) {
    return null
  }
  if (kind != null && captured.kind !== kind) {
    return null
  }

  // The URL check lives here and not in the capture: an edge that has not published URLs yet still
  // earns adoption — the LCP win is real either way — it just gets no first paint from us.
  const urls = publishedUrls(captured.mediaNode)
  if (!urls) return null

  const isVideo = captured.kind === 'videos'
  return {
    photo: {
      id: captured.photoId,
      thumbUrl: urls.thumb,
      imgUrl: urls.src,
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
 * Hand #root back to React: the frame — whichever producer painted it — is removed and both slots of
 * this store go empty. Called when the route leaves a detail page, or when an edge-painted frame
 * turns out not to describe the page (wrong id, wrong kind, no record). Navigating between two detail
 * pages does NOT clear: `paintClientDetailFrame` replaces the frame in one step, so prev/next never
 * shows a blank page.
 */
export const clearDetailSkeleton = function () {
  if (!captured && !painted) {
    return
  }
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = ''
  }
  captured = null
  painted = null
  listeners.forEach((listener) => listener())
}

/** Test seam: forget any capture or paint and re-arm, so a suite can simulate fresh boots. */
export const __resetDetailSkeletonForTests = function () {
  captured = null
  painted = null
  attempted = false
}
