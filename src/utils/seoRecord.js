// The per-media SEO record: img.wisaw.com/<id>.json, published by the same job that writes the
// sitemap and refreshed whenever a comment changes. It sits next to the media it describes and is
// public by design - Lambda@Edge reads it for the first byte of every media page - so the app can
// read the very same object instead of composing its own title and description. That is what makes
// the crawler's copy and the hydrated copy identical.
//
// Fetching is best-effort: a missing or malformed record yields null and the caller falls back to
// re-declaring what the server already served, so a slow bucket can never leave a page headless.

const RECORD_ORIGIN = 'https://img.wisaw.com'

// Matches the edge cache TTL; a comment edit refreshes the record immediately, this only bounds how
// long an already-open tab waits to notice.
const POSITIVE_TTL_MS = 10 * 60 * 1000
// Short enough that a photo whose record is published minutes later gets one in the same session.
const NEGATIVE_TTL_MS = 60 * 1000

const cache = new Map()
const inflight = new Map()

export function recordUrl (id) {
  return `${RECORD_ORIGIN}/${String(id ?? '').toLowerCase()}.json`
}

/** True when a record carries finished strings for the media kind being viewed. */
export function isUsableRecord (record, kind) {
  const seo = record?.seo
  if (seo == null || typeof seo !== 'object') return false
  // A record describes one media type; wearing the other kind's title would be worse than deriving.
  if (String(seo.kind ?? '') !== String(kind)) return false
  return typeof seo.title === 'string' && seo.title.trim() !== ''
}

function entryIsFresh (entry) {
  if (entry == null) return false
  const ttl = entry.value == null ? NEGATIVE_TTL_MS : POSITIVE_TTL_MS
  return Date.now() - entry.at < ttl
}

/** A usable record already in this tab's cache, or null. Never triggers a request. */
export function peekSeoRecord (id, kind) {
  const entry = cache.get(String(id ?? '').toLowerCase())
  if (!entryIsFresh(entry)) return null
  return isUsableRecord(entry.value, kind) ? entry.value : null
}

function readRecord (id) {
  const key = String(id ?? '').toLowerCase()
  if (inflight.has(key)) return inflight.get(key)

  const request = fetch(recordUrl(id), { headers: { Accept: 'application/json' } })
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => (body != null && typeof body === 'object' && !Array.isArray(body) ? body : null))
    .catch(() => null) // offline, blocked, or a 404 that arrived as HTML - all mean "no record"
    .then((value) => {
      cache.set(key, { at: Date.now(), value })
      inflight.delete(key)
      return value
    })

  inflight.set(key, request)
  return request
}

/**
 * The record for one media id, or null. Resolves rather than rejects so callers can render without
 * a try/catch at every call site; concurrent calls for the same id share one request.
 */
export async function fetchSeoRecord (id, kind) {
  const key = String(id ?? '').toLowerCase()
  const entry = cache.get(key)
  // A remembered miss answers too, otherwise every re-render of a photo without a record asks again.
  if (entryIsFresh(entry)) {
    if (entry.value == null) return null
    return isUsableRecord(entry.value, kind) ? entry.value : null
  }

  const record = await readRecord(id)
  return isUsableRecord(record, kind) ? record : null
}

/** Test hook and cache-clearing on a hard reload; not used by the app itself. */
export function clearSeoRecordCache () {
  cache.clear()
  inflight.clear()
}
