import { ROBOTS_INDEX, SITE_NAME, TWITTER_CARD } from './seoDefaults'

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

// Google's image rich results read og:image:title and og:image:caption, and they must carry
// different information: the recognition labels in the title, the newest comment in the caption.
// The edge publishes this pair with data-rh, so if the app does not declare them too, Helmet
// treats the edge's copy as an unmanaged tag and removes it the moment React mounts.
const IMAGE_TITLE_MAX = 100
const IMAGE_CAPTION_MAX = 512

function imageText (photo, { labels = '', comment = '' } = {}) {
  const imageTitle = String(labels ?? '').trim().slice(0, IMAGE_TITLE_MAX)
  // An echo of the title under another name tells a crawler nothing, so the caption drops.
  const imageCaption = String(comment ?? '').trim().slice(0, IMAGE_CAPTION_MAX)
  return {
    imageTitle: imageTitle || undefined,
    imageCaption: imageCaption && imageCaption !== imageTitle ? imageCaption : undefined
  }
}

function mediaHead (photo, { title = '', description = '', labels = '', comment = '', pathname = '' } = {}) {
  const isVideo = photo?.video === true
  const head = {
    title,
    description,
    // The id belongs in the URL, not in the title a person reads in a search result.
    ogTitle: title,
    ogType: isVideo ? 'video.other' : 'photo',
    twitterCard: TWITTER_CARD,
    imageUrl: photo?.thumbUrl || undefined,
    url: pageUrl(photo, pathname),
    siteName: SITE_NAME,
    robots: ROBOTS_INDEX,
    ...imageText(photo, { labels, comment })
  }

  if (isVideo) {
    const { width, height } = dimensionPair(photo)
    head.video = {
      url: photo?.videoUrl || undefined,
      width,
      height,
      posterUrl: photo?.thumbUrl || undefined
    }
  }

  return head
}

const publisher = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: 'https://wisaw.com'
}

function mediaGraph (photo, { title = '', description = '', comment = '', pathname = '' } = {}) {
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

export { breadcrumbGraph, mediaGraph, mediaHead, pageUrl, pathSegment, segmentFromPath }
