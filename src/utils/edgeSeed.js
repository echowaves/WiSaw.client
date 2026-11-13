/**
 * Seed the detail page's first paint from what Lambda@Edge already put in front of the browser.
 *
 * The edge injects the media element (and its natural width/height) into the mount point before
 * any JavaScript runs, and the inline LCP scripts copy that onto window.__wisawLcp. React renders
 * client-side, so without this seed its first commit destroys the already-painted thumbnail with a
 * skeleton while getPhotoAllCurr round-trips AppSync - on throttled mobile that round trip alone
 * pushes Largest Contentful Paint past 5 s. Seeding means the first commit paints the same box the
 * edge painted, and comments/recognitions hydrate over it when the real record arrives.
 *
 * The seed is deliberately minimal: only fields the render path reads, with the URLs and size the
 * edge itself published. Anything unknown (duration, capture date, watcher count) stays absent -
 * src/utils/mediaSeo.js emits only facts it has, so the head matches what a crawler already saw.
 */

const positiveInt = (value) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * A currPhoto-shaped record for this route when the inline LCP plan describes it - null otherwise.
 * `kind` is the route segment (/photos/... or /videos/...) exactly as the preload script derived
 * it, so a photo id served under /videos/ (or vice versa) does not seed the wrong kind of page.
 * Missing dimensions mean unknown aspect ratio: return null and let the skeleton reserve space,
 * because painting 300x300 and jumping to the real ratio would be a layout shift we are trying
 * to remove in the first place.
 */
export const edgeSeededPhoto = (photoId, kind) => {
  if (typeof window === 'undefined') {
    return null
  }

  const plan = window.__wisawLcp
  if (!plan || !plan.id || String(plan.id) !== String(photoId ?? '')) {
    return null
  }
  if (kind != null && plan.kind !== kind) {
    return null
  }

  const width = positiveInt(plan.width)
  const height = positiveInt(plan.height)
  if (width == null || height == null) {
    return null
  }

  const isVideo = plan.kind === 'videos'
  // A video page without its real object URL would render an empty source that errors over the
  // poster; the edge always publishes one, so a missing value means "nothing trustworthy to seed".
  if (isVideo && !(plan.videoSrc || '')) {
    return null
  }

  return {
    photo: {
      id: plan.id,
      thumbUrl: plan.thumb,
      imgUrl: plan.full,
      video: isVideo,
      videoUrl: isVideo ? (plan.videoSrc || '') : '',
      width,
      height
    },
    comments: [],
    recognitions: []
  }
}
