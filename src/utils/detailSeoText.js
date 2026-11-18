/**
 * The wording a detail page shows in its heading, description and tag row.
 *
 * That copy is authored once, on the backend (WiSaw.cdk
 * lambda-fns/lambdas/seoUtils/seoRules.js), stored on the sitemap sidecar
 * `https://img.wisaw.com/<id>.json`, and read by Lambda@Edge when it paints a
 * cold deep link. Nothing in the GraphQL detail record carries it, so a page
 * reached by prev/next has to read the same sidecar or it would have to
 * re-derive the wording from labels the API happens to return — which is how
 * the two render paths came to show different sentences for one photo.
 *
 * Reading can fail (sidecar not generated yet, offline, CORS blocked before the
 * img.wisaw.com `*.json` behaviour ships). Every failure resolves to null and
 * the caller paints without a description rather than showing a spinner: the
 * frame is already on screen from the record, and the copy is enhancement.
 */

// Mirrors MEDIA_ORIGIN in index.html's inline bootstrap; kept in sync by
// src/utils/detailSeoText.test.js because both build URLs for the same bucket.
const MEDIA_ORIGIN = 'https://img.wisaw.com'

/** Shape the detail template wants: heading text, description sentence, tag links. */
export const sidecarUrlFor = (photoId) => `${MEDIA_ORIGIN}/${encodeURIComponent(photoId)}.json`

const byId = new Map()
const inflight = new Map()

/** Normalise one sidecar body into the template's wording inputs, or null. */
export const parseSidecar = (body) => {
  if (!body || typeof body !== 'object') return null
  const seo = body.seo && typeof body.seo === 'object' ? body.seo : {}
  const title = typeof seo.title === 'string' ? seo.title.trim() : ''
  if (!title) return null // a sidecar without a title is not usable wording
  const labels = Array.isArray(body.labels)
    ? body.labels.filter((label) => typeof label === 'string' && label.trim()).map((label) => label.trim())
    : []
  // Only what a page renders. `seo.imageTitle` describes og:image:title, which only the edge ever
  // publishes, and the media's alt text is composed from the record's own comment by the caller.
  return {
    title,
    kind: seo.kind === 'video' ? 'video' : 'photo',
    description: typeof seo.description === 'string' ? seo.description.trim() : '',
    imageCaption: typeof seo.imageCaption === 'string' ? seo.imageCaption.trim() : '',
    labels
  }
}

/** Cached wording for a photo id, or null when it has not arrived / failed. */
export const getCachedSeoText = (photoId) => (photoId ? byId.get(photoId) || null : null)

/**
 * Read (or return the cached) wording sidecar for a photo id. Never rejects: a page whose copy has
 * not arrived is a page without that copy, not a broken one — the frame is already painted from the
 * record. Only an authoritative answer is cached; see below.
 */
export const fetchSeoText = (photoId) => {
  if (!photoId) return Promise.resolve(null)
  if (byId.has(photoId)) return Promise.resolve(byId.get(photoId))
  if (inflight.has(photoId)) return inflight.get(photoId)

  // Absence is an answer worth remembering: a freshly uploaded photo has no sidecar yet, and going
  // back to it later should not re-request it. Offline, throttled, 5xx or an unreadable body are not
  // answers — caching those would leave that photo without its published wording for the rest of the
  // session (prev, next, prev), which is exactly the failure WiSaw.cdk's edge reader refuses to
  // cache. An unanswered id simply asks again on the next render.
  const request = (async () => {
    let answered = false
    let parsed = null
    try {
      const response = await fetch(sidecarUrlFor(photoId), { headers: { Accept: 'application/json' } })
      if (response && response.status === 404) {
        answered = true
      } else if (response && response.ok) {
        parsed = parseSidecar(await response.json())
        answered = true
      }
    } catch {
      // No answer at all — a page with no fetch, an offline visitor, or a blocked request.
    }
    if (answered) {
      byId.set(photoId, parsed)
    }
    return parsed
  })().finally(() => inflight.delete(photoId))

  inflight.set(photoId, request)
  return request
}

/** Warm the cache for ids the user is about to navigate to. Fire and forget. */
export const prefetchSeoText = (photoIds) => {
  for (const photoId of photoIds || []) {
    if (photoId && !byId.has(photoId)) {
      fetchSeoText(photoId).catch(() => {})
    }
  }
}

/** Test hook: the module caches per id for the life of the page. */
export const __resetSeoTextForTests = () => {
  byId.clear()
  inflight.clear()
}
