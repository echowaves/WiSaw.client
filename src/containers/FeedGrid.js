/* eslint-disable react/react-in-jsx-scope */
/**
 * The single feed layout. `/` and `/search/:term` both render their masonry grid through this
 * module, so one record draws an identical card on either route (2026-11-04 no-upscale sizing,
 * shared breakpoints, border hugging the thumb, remeasure on viewport change).
 *
 * Pages keep everything that is not layout — data fetching, headings, search box, SEO tags and
 * empty/no-result blocks — and pass it in as `children` rendered above the feed. Nothing outside
 * this file renders `.masonry-grid`, `.home-thumb-card` or the load-more spinner.
 */
import { useEffect, useState } from 'react'

import InfiniteScroll from 'react-infinite-scroll-component'
import Masonry from 'react-masonry-css'
import { Bars } from 'react-loader-spinner'
import { Link } from 'react-router-dom'

import './PhotosComponent.css'

import { FEED_BREAKPOINT_COLS, getFeedThumbSize } from '../utils/imageUtils'

/**
 * The site's spinner markup. Exported so a page can show it outside the feed (Search's first
 * frame) without growing a second copy of the `Bars` props.
 */
export const FeedLoader = function ({ label }) {
  return (
    <div className='infinite-scroll-loader' aria-label={label}>
      <Bars
        height='40'
        width='40'
        color='#7c8cf8'
        ariaLabel='spinner-loading-indicator'
        wrapperStyle={{}}
        wrapperClass=''
        visible
      />
    </div>
  )
}

const FeedGrid = function ({ photos, next, hasMore, scrollKey, altFor, children }) {
  // Re-measure feed card boxes when the viewport changes (rotate/resize),
  // since their widths are computed from window dimensions at render time.
  const [, forceRemeasure] = useState(0)

  useEffect(() => {
    // Coalesce bursts of resize events into one render per frame, like react-masonry-css does
    let frame = 0
    const onViewportChange = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => forceRemeasure((tick) => tick + 1))
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('orientationchange', onViewportChange)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('orientationchange', onViewportChange)
    }
  }, [])

  const renderCard = function (photo) {
    const thumb = getFeedThumbSize(photo)

    return (
      <div
        className='home-thumb-card'
        style={{
          overflow: 'hidden',
          // Shrink the card to the image so its border hugs the thumb with no side gaps;
          // fall back to full-column when the photo's aspect ratio is unknown
          width: thumb.width ?? '100%',
          maxWidth: '100%',
          marginInline: 'auto'
        }}
        key={photo.id}
      >
        <Link
          to={`/${photo?.video === true ? 'videos' : 'photos'}/${encodeURIComponent(photo.id)}`}
          // Lets the detail page paint at the right size before GraphQL resolves
          state={{ feedPhoto: photo }}
          style={{ width: '100%', display: 'block' }}
        >
          <div
            className='thumbnail-wrapper'
            style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              display: 'block',
              lineHeight: 0,
              position: 'relative'
            }}
          >
            <img
              src={photo.thumbUrl}
              width={thumb.width}
              height={thumb.height}
              loading='lazy'
              style={{
                // Explicit px width keeps the width/height attrs effective for the
                // pre-load box (no CLS); it never exceeds the natural thumb width,
                // and maxWidth shrinks to fit if the column math is ever off
                width: thumb.width != null ? `${thumb.width}px` : 'auto',
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
                margin: 0,
                padding: 0
              }}
              alt={altFor(photo)}
              onError={(e) => {
                e.target.onerror = null
                e.target.src = '/logo192.png' // Fallback image
                e.target.style.width = '100%' // Placeholder fills the card, no gutters
              }}
            />
            {photo?.video === true && (
              <div className='video-indicator' role='img' aria-label='Video content'>
                ▶
              </div>
            )}
          </div>
          {photo?.lastComment && (
            <div style={{ width: '100%', paddingBottom: 15, padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              {/* Truncate the comment to prevent potential XSS */}
              {photo.lastComment.substring(0, 150)}
            </div>
          )}
        </Link>
      </div>
    )
  }

  return (
    <main
      style={{
        display: 'flex',
        width: '100%',
        position: 'relative',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          maxWidth: '1120px',
          width: '90%',
          position: 'relative',
          alignSelf: 'center',
          justifyContent: 'center'
        }}
      >
        {children}

        {/* No feed at all until a page of records has arrived: an empty InfiniteScroll would put
            "Yay! You have seen it all" under a page that is still loading or found nothing. */}
        {photos.length > 0 && (
          <InfiniteScroll
            key={scrollKey || 'feed'}
            style={{
              position: 'relative',
              overflow: 'unset'
            }}
            dataLength={photos.length} // This is important field to render the next data
            next={next}
            hasMore={hasMore}
            loader={<FeedLoader label='Loading more content' />}
            endMessage={
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <b>Yay! You have seen it all</b>
              </p>
            }
          >
            <Masonry
              breakpointCols={FEED_BREAKPOINT_COLS}
              className='masonry-grid'
              columnClassName='masonry-grid-column'
            >
              {photos.map(renderCard)}
            </Masonry>
          </InfiniteScroll>
        )}
      </div>
    </main>
  )
}

export default FeedGrid
