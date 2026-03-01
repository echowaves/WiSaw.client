/* eslint-disable react/react-in-jsx-scope */
import { useEffect, useState } from 'react'
import { Helmet } from '@dr.pogodin/react-helmet'

import InfiniteScroll from 'react-infinite-scroll-component'
import Masonry from 'react-masonry-css'
import {
  Link,
  useNavigate
} from 'react-router-dom'

import Button from 'react-bootstrap/Button'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'

// import ReactGA from 'react-ga'
import ReactGA from 'react-ga4'

import './PhotosComponent.css'

// import {
//   Link,
//   useLocation,
//   useParams,
// } from "react-router-dom"

// import PropTypes from 'prop-types'
import { gql } from '@apollo/client'

import * as CONST from '../consts'
import { getOptimizedThumbnailDimensions } from '../utils/imageUtils'

const Home = function () {
  const [photos, setPhotos] = useState([])
  const [pageNumber, setPageNumber] = useState(0)
  const [noMoreData, setNoMoreData] = useState(true)
  const [searchText, setSearchText] = useState('')
  const navigate = useNavigate()

  const init = async () => {
    ReactGA.send({
      hitType: 'pageview',
      page: '/'
      // title: "Custom Title",
    })
  }

  useEffect(() => {
    retrievePhotos()
    init()
  }, [])

  // const embedded = new URLSearchParams(location.search).get("embedded")
  const retrievePhotos = async () => {
    try {
      // console.log({pageNumber})

      const response = await CONST.gqlClient.query({
        query: gql`
          query feedRecent($pageNumber: Int!, $batch: String!) {
            feedRecent(pageNumber: $pageNumber, batch: $batch) {
              photos {
                id
                uuid
                imgUrl
                thumbUrl
                videoUrl
                video
                commentsCount
                watchersCount
                lastComment
                createdAt
                width
                height
              }
              batch
              noMoreData
            }
          }
        `,
        variables: {
          pageNumber,
          batch: '0' // Convert to string to prevent potential integer overflow
        }
      })

      // console.log({response})
      setPageNumber(pageNumber + 1)
      setNoMoreData(response.data.feedRecent.noMoreData)
      setPhotos([...photos, ...response.data.feedRecent.photos])
      // console.log({pageNumber, noMoreData: response.data.feedRecent.noMoreData})
      return {
        photos: response.data.feedRecent.photos,
        batch: response.data.feedRecent.batch,
        noMoreData: response.data.feedRecent.noMoreData
      }
    } catch (err) {
      console.error('Error retrieving photos:', err.message)
      return {
        photos: [],
        batch: '0',
        noMoreData: true
      }
    }
  }
  const handleSearch = function (event) {
    if (event) {
      event.preventDefault()
    }

    if (searchText && searchText.trim()) {
      navigate(`/search/${encodeURIComponent(searchText.trim())}`)
      setSearchText('')
    }
  }
  const searchTextHandler = function (event) {
    setSearchText(event.target.value)
    // console.log(event.target.value)
  }

  const renderSearchComponent = function () {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'right',
          // alignItems: 'center',
          paddingBottom: '10px'
        }}
      >
        <Form onSubmit={handleSearch}>
          <Row>
            <Col xs='auto'>
              <Form.Control
                type='input'
                placeholder='What are you looking for...'
                value={searchText}
                onChange={searchTextHandler}
                aria-label='Search input'
              />
            </Col>
            <Col xs='auto'>
              <Button variant='primary' type='submit'>
                Search
              </Button>
            </Col>
          </Row>
        </Form>
      </div>
    )
  }

  const renderInfiniteFeed = function () {
    return (
      <InfiniteScroll
        style={{
          position: 'relative',
          overflow: 'unset'
        }}
        dataLength={photos.length} // This is important field to render the next data
        next={retrievePhotos}
        hasMore={!noMoreData}
        loader={<div aria-label='Loading content' style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>Loading...</div>}
        endMessage={
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <b>Yay! You have seen it all</b>
          </p>
        }
      // below props only if you need pull down functionality
      // refreshFunction={this.refresh}
      // pullDownToRefresh
      // pullDownToRefreshThreshold={50}
      // pullDownToRefreshContent={
      //   <h3 style={{ textAlign: 'center' }}>&#8595; Pull down to refresh</h3>
      // }
      // releaseToRefreshContent={
      //   <h3 style={{ textAlign: 'center' }}>&#8593; Release to refresh</h3>
      // }
      >
        <Masonry
          breakpointCols={{
            default: 4,
            1100: 3,
            700: 2,
            500: 1
          }}
          className='masonry-grid'
          columnClassName='masonry-grid-column'
        >
          {photos.map((photo) => {
            const thumbDimensions = getOptimizedThumbnailDimensions(photo)

            return (
              <div
                className='home-thumb-card'
                style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden'
                }}
                key={photo.id}
              >
                <Link
                  to={`/${photo?.video === true ? 'videos' : 'photos'}/${encodeURIComponent(photo.id)}`}
                  style={{ width: '100%', display: 'block' }}
                >
                  {photo?.lastComment && (
                    <>
                      <div
                        className='thumbnail-wrapper'
                        style={{
                          borderRadius: 'var(--radius-lg)',
                          overflow: 'hidden',
                          display: 'block',
                          width: '100%',
                          lineHeight: 0,
                          position: 'relative'
                        }}
                      >
                        <img
                          src={photo.thumbUrl}
                          width={thumbDimensions?.width}
                          height={thumbDimensions?.height}
                          loading='lazy'
                          style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            objectFit: 'cover',
                            margin: 0,
                            padding: 0
                          }}
                          alt={photo?.lastComment || `Photo ${photo.id}`}
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = '/logo192.png' // Fallback image
                          }}
                        />
                        {photo?.video === true && (
                          <div className='video-indicator' role='img' aria-label='Video content'>
                            ▶
                          </div>
                        )}
                      </div>
                      <div style={{ width: '100%', paddingBottom: 15, padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {/* Truncate the comment to prevent potential XSS */}
                        {photo?.lastComment.substring(0, 150)}
                      </div>
                    </>
                  )}
                  {!photo?.lastComment && (
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
                        width={thumbDimensions?.width}
                        height={thumbDimensions?.height}
                        loading='lazy'
                        style={{
                          width: '100%',
                          height: 'auto',
                          display: 'block',
                          margin: 0,
                          padding: 0
                        }}
                        alt={photo?.video === true ? 'Free stock video on WiSaw' : 'Free stock photo on WiSaw'}
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.src = '/logo192.png' // Fallback image
                        }}
                      />
                      {photo?.video === true && (
                        <div className='video-indicator' role='img' aria-label='Video content'>
                          ▶
                        </div>
                      )}
                    </div>
                  )}
                </Link>
              </div>
            )
          })}
        </Masonry>
      </InfiniteScroll>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        position: 'relative',
        justifyContent: 'center'
        // textAlign: 'center',
        // backgroundColor: '#0666a3'
      }}
    >
      <Helmet prioritizeSeoTags>
        <title>Free Stock Photos & Videos -- What I Saw</title>
        <meta name='description' content='Free Stock Photos and Videos, Royalty Free Stock Images & Copyright Free Pictures, Unaltered, Taken With Phone Cameras, free pictures no copyright' />
        <link
          rel='canonical'
          href='https://wisaw.com'
        />
        {/* Open Graph / Facebook */}
        <meta property='og:type' content='website' />
        <meta property='og:url' content='https://wisaw.com' />
        <meta property='og:title' content='WiSaw - Free Authentic Stock Photos & Videos' />
        <meta property='og:description' content='Discover WiSaw, a community-driven platform for authentic, royalty-free stock photos and videos captured by everyday creators worldwide.' />
        <meta property='og:image' content='https://wisaw.com/android-chrome-512x512.png' />
        <meta property='og:site_name' content='WiSaw' />

        {/* Twitter */}
        <meta name='twitter:card' content='summary_large_image' />
        <meta name='twitter:url' content='https://wisaw.com' />
        <meta name='twitter:title' content='WiSaw - Free Authentic Stock Photos & Videos' />
        <meta name='twitter:description' content='Discover WiSaw, a community-driven platform for authentic, royalty-free stock photos and videos captured by everyday creators worldwide.' />
        <meta name='twitter:image' content='https://wisaw.com/android-chrome-512x512.png' />

        {/* WebSite structured data for Google sitelinks search box */}
        <script type='application/ld+json'>
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'WiSaw',
            alternateName: 'What I Saw',
            url: 'https://wisaw.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://wisaw.com/search/{search_term_string}'
              },
              'query-input': 'required name=search_term_string'
            }
          })}
        </script>
        {/* Organization structured data */}
        <script type='application/ld+json'>
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'WiSaw',
            url: 'https://wisaw.com',
            logo: 'https://wisaw.com/android-chrome-512x512.png',
            sameAs: [
              'https://www.facebook.com/echowaves2/',
              'https://x.com/echowaves',
              'https://www.linkedin.com/groups/13040336/'
            ]
          })}
        </script>
        {/* CollectionPage structured data */}
        <script type='application/ld+json'>
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Free Stock Photos & Videos',
            description: 'Free Stock Photos and Videos, Royalty Free Stock Images & Copyright Free Pictures, Unaltered, Taken With Phone Cameras',
            url: 'https://wisaw.com',
            provider: {
              '@type': 'Organization',
              name: 'WiSaw',
              url: 'https://wisaw.com'
            }
          })}
        </script>
      </Helmet>

      <div
        style={{
          // width: '100%',
          maxWidth: '1120px',
          width: '90%',
          position: 'relative',
          alignSelf: 'center',
          justifyContent: 'center'
        }}
      >
        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          lineHeight: '1.2',
          marginBottom: '1rem',
          color: 'var(--text-primary)'
        }}
        > Unaltered Photos and Videos, Taken with Phone Cameras.
        </h1>

        <h2 style={{
          fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
          lineHeight: '1.4',
          fontWeight: '400',
          marginBottom: '2rem',
          color: 'var(--text-secondary)'
        }}
        >It&apos;s almost expected that the lighting won&apos;t be perfect and the composition might be off at times,
          because the goal is to capture shots spontaneously, with minimal preparation—just point and shoot.
          As photographers, we often worry too much about getting everything perfect,
          and in doing so, we miss great opportunities.
        </h2>
        {renderSearchComponent()}
        {renderInfiniteFeed()}
      </div>
    </div>
  )
}

export default Home
