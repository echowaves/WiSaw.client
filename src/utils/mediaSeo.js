import { ROBOTS_INDEX, SITE_NAME, TWITTER_CARD } from './seoDefaults'
import { isUsableRecord } from './seoRecord'

// Everything the head of a photo/video page says about that page, derived in one place. The
// values here are what the Lambda@Edge injector publishes for the same URL before any
// JavaScript runs, so a crawler that renders the page and one that doesn't see the same
// document. Only facts we actually have are emitted: an unknown duration or capture date is
// left out rather than guessed, because a wrong value in rich-result markup is worse than a
// missing one.

// The path a media item was asked for, not the kind its record claims. /photos/<id> and
// /videos/<id> both mount this page, and the edge derives its canonical from the request URI -
// deriving ours from the record would let one video declare two pages that each point at the
// other as the original.
const segmentFromPath = function (pathname = '') {
  const match = String(pathname).match(/^\/(photos|videos)\//)
  return match ? match[1] : undefined
}

const pathSegment = function (photo, pathname) {
  return segmentFromPath(pathname) ?? (photo?.video === true ? 'videos' : 'photos')
}

const pageUrl = function (photo, pathname) {
  return `https://wisaw.com/${pathSegment(photo, pathname)}/${photo?.id ?? ''}`
}

// Positive integers only: the layout falls back to 640x360 for sizing, but inventing
// dimensions in markup would tell a search engine the media is a size it isn't.
const positiveInt = function (value) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const dimensionPair = function (photo) {
  const width = positiveInt(photo?.width)
  const height = positiveInt(photo?.height)
  return { width, height }
}

// How long the media actually is. Nothing upstream ever told us: the app uploads bytes without a
// length, and production objects carry no upload-time metadata (WiSaw.cdk evidence
// /probe-duration-metadata.js), so the number is read out of the stored container by the backend and
// published here. The rules below mirror seoRules.js in the backend one-for-one - same shapes, same
// 24-hour ceiling - and src/videoDuration.contract.test.js pins that agreement against the real
// backend module, because a second copy of a rule is exactly the bug class this project keeps
// removing. Unknown stays undefined: never 0, so no page can claim a length nobody measured.
const MAX_DURATION_SECONDS = 86400

function normaliseSeconds (value) {
  const seconds = Math.floor(Number(value))
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_DURATION_SECONDS) return undefined
  return seconds
}

// "PT1H2M3S" -> seconds. Fractional seconds are floored; a designator-free "PT" is rejected.
function isoToSeconds (text) {
  const match = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/i)
  if (match == null || (match[1] == null && match[2] == null && match[3] == null)) return undefined
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
  return normaliseSeconds(seconds)
}

// "9:05" and "1:02:03" - the clock shape players and some uploads use.
function clockToSeconds (text) {
  if (!/^\d{1,2}(:[0-5]?\d){1,2}$/.test(text)) return undefined
  const seconds = text.split(':').reduce((total, part) => total * 60 + Number(part), 0)
  return normaliseSeconds(seconds)
}

/** Whole positive seconds from a number, "48", "0:48", "1:02:03" or "PT1M2S"; undefined if none. */
export function durationSeconds (value) {
  if (typeof value === 'number') return normaliseSeconds(value)
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (/^\d+$/.test(text)) return normaliseSeconds(Number(text))
  if (/^PT/i.test(text)) return isoToSeconds(text)
  return clockToSeconds(text)
}

/** The ISO 8601 form Google's VideoObject wants, or '' when the value is not a real duration. */
export function iso8601Duration (value) {
  const seconds = durationSeconds(value)
  if (seconds == null) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `PT${hours}H${minutes}M${rest}S`
  if (minutes > 0) return `PT${minutes}M${rest}S`
  return `PT${rest}S`
}

// The four text slots a media page carries: <title>/og:title, meta description, and the
// og:image:title / og:image:caption pair Google's image rich results read. They are resolved here,
// in one priority order, because every one of them must say the same thing the crawler was served:
//
//   1. the media's SEO record (img.wisaw.com/<id>.json), which already holds finished strings
//      composed by the same rules the edge used to publish its first byte;
//   2. what the edge injected into THIS document, re-declared unchanged - Helmet drops any injected
//      tag the app does not claim, so a page whose record has not been written yet still has to say
//      something, and repeating the served bytes cannot disagree with them;
//   3. facts held locally, only when neither is available: an SPA navigation to a media item with no
//      record yet must still show a title rather than a blank tab.
//
// Nothing here composes text out of labels any more when a record exists - that second copy of the
// rules is what made first byte and hydrated head disagree.

function textFromRecord (record, photo) {
  const kind = photo?.video === true ? 'video' : 'photo'
  if (!isUsableRecord(record, kind)) return null
  const seo = record.seo
  return {
    title: seo.title,
    description: typeof seo.description === 'string' ? seo.description : '',
    imageTitle: seo.imageTitle || undefined,
    imageCaption: seo.imageCaption || undefined,
    source: 'record'
  }
}

function textFromServed (served) {
  if (served == null || typeof served.title !== 'string' || served.title === '') return null
  return {
    title: served.title,
    description: typeof served.description === 'string' ? served.description : '',
    imageTitle: served.imageTitle,
    imageCaption: served.imageCaption,
    source: 'served'
  }
}

/**
 * Last resort, and the only place the app still assembles a sentence for the head. It exists because
 * navigating from the feed mounts a page the edge never rendered for this URL, so there is nothing
 * served to repeat - but a blank title is worse than an unenriched one.
 */
function unenrichedText (photo, { labels = '', comment = '' } = {}) {
  const kindLabel = photo?.video === true ? 'video' : 'photo'
  const labelList = String(labels ?? '').trim()
  const title = `${labelList || photo?.id || ''}`.trim()
  return {
    title: title !== '' ? `${title} - Free ${kindLabel} on WiSaw` : `WiSaw ${kindLabel}`,
    description: String(comment ?? '').trim(),
    imageTitle: labelList || undefined,
    // An echo of the title under another name tells a crawler nothing, so the caption drops.
    imageCaption: (() => {
      const caption = String(comment ?? '').trim()
      return caption !== '' && caption !== labelList ? caption : undefined
    })(),
    source: 'fallback'
  }
}

function mediaHead (photo, { record = null, served = null, fallback = null, pathname = '' } = {}) {
  const isVideo = photo?.video === true
  const text = textFromRecord(record, photo) ?? textFromServed(served) ?? textFromServed(fallback) ?? unenrichedText(photo, {})
  const title = text.title
  const head = {
    title,
    description: text.description,
    // The id belongs in the URL, not in the title a person reads in a search result.
    ogTitle: title,
    imageTitle: text.imageTitle,
    imageCaption: text.imageCaption,
    textSource: text.source,
    ogType: isVideo ? 'video.other' : 'photo',
    twitterCard: TWITTER_CARD,
    imageUrl: photo?.thumbUrl || undefined,
    url: pageUrl(photo, pathname),
    siteName: SITE_NAME,
    robots: ROBOTS_INDEX
  }

  if (isVideo) {
    const { width, height } = dimensionPair(photo)
    // The record's number wins: it is the one the edge put into this URL's first byte. A video the
    // record has never described can still carry the API column, which holds the same measurement.
    const fromRecord = isUsableRecord(record, 'video') ? record.seo.duration : undefined
    head.video = {
      url: photo?.videoUrl || undefined,
      width,
      height,
      posterUrl: photo?.thumbUrl || undefined,
      duration: durationSeconds(fromRecord ?? photo?.duration)
    }
  }

  return head
}

const publisher = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: 'https://wisaw.com'
}

function mediaGraph (photo, { title = '', description = '', comment = '', duration = null, pathname = '' } = {}) {
  const isVideo = photo?.video === true
  const { width, height } = dimensionPair(photo)
  const interactionCount = positiveInt(photo?.watchersCount)

  const shared = {
    '@context': 'https://schema.org',
    name: title,
    description: description || title,
    url: pageUrl(photo, pathname),
    thumbnailUrl: photo?.thumbUrl || undefined,
    creditText: SITE_NAME,
    creator: { ...publisher, url: 'https://wisaw.com' }
  }

  if (interactionCount) {
    shared.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: { '@type': isVideo ? 'WatchAction' : 'ViewAction' },
      userInteractionCount: interactionCount
    }
  }

  if (isVideo) {
    return {
      ...shared,
      // Same @type the edge publishes for this URL.
      '@type': 'VideoObject',
      contentUrl: photo?.videoUrl || undefined,
      embedUrl: pageUrl(photo, pathname),
      // Google qualifies the rich result on this, so it is published only once some part of the
      // stack has actually measured the file.
      duration: iso8601Duration(duration ?? photo?.duration) || undefined,
      uploadDate: photo?.createdAt || undefined,
      width,
      height,
      encodingFormat: String(photo?.videoUrl ?? '').endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
      publisher
    }
  }

  return {
    ...shared,
    // Same @type the edge publishes for this URL.
    '@type': 'Photograph',
    contentUrl: photo?.imgUrl || undefined,
    license: 'https://wisaw.com/terms',
    datePublished: photo?.createdAt || undefined,
    caption: comment || undefined,
    width,
    height,
    encodingFormat: 'image/webp',
    publisher
  }
}

// Google requires an item on every breadcrumb but the last. The old markup pointed position 2
// at the site root and gave position 3 no target at all; there is no /photos or /videos
// listing page to point at, so the trail is home then this page.
function breadcrumbGraph (photo, { title = '', pathname = '' } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://wisaw.com/'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title,
        item: pageUrl(photo, pathname)
      }
    ]
  }
}

export { breadcrumbGraph, mediaGraph, mediaHead, pageUrl, pathSegment, segmentFromPath, unenrichedText }
