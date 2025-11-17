/* eslint-disable react/react-in-jsx-scope */
import { lazy, useEffect, useState } from 'react'
import {
  Link,
  useNavigate, useParams
} from 'react-router-dom'

import { Helmet } from 'react-helmet-async'
// import "react-loader-spinner/dist/loader/css/react-spinner-loader.css"
import { Bars } from 'react-loader-spinner'

import InfiniteScroll from 'react-infinite-scroll-component'
import Masonry from 'react-masonry-css'

import Button from 'react-bootstrap/Button'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'
import Row from 'react-bootstrap/Row'

import './PhotosComponent.css'

import ReactGA from 'react-ga4'

// import PropTypes from 'prop-types'
import { gql } from '@apollo/client'
// import stringifyObject from 'stringify-object'
import * as CONST from '../consts'
import { getOptimizedThumbnailDimensions } from '../utils/imageUtils'

const Footer = lazy(() => import('./Footer'))

const FEED_FOR_TEXT_SEARCH = gql`
  query feedForTextSearch(
    $searchTerm: String!
    $pageNumber: Int!
    $batch: String!
  ) {
    feedForTextSearch(
      searchTerm: $searchTerm
      pageNumber: $pageNumber
      batch: $batch
    ) {
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
`

const SearchComponent = function () {
  const { searchString } = useParams()
  const navigate = useNavigate()

  const [photos, setPhotos] = useState([])
  const [pageNumber, setPageNumber] = useState(0)
  const [noMoreData, setNoMoreData] = useState(true)
  const [requestComplete, setRequestComplete] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const derivePaginationState = (resetFlag, currentPage, currentPhotos) => {
    if (resetFlag) {
      return { targetPage: 0, existingPhotos: [] }
    }
    return { targetPage: currentPage, existingPhotos: currentPhotos }
  }
  const handleSearchFailure = (reset) => {
    if (reset) {
      setPhotos([])
      setPageNumber(0)
    }
    setNoMoreData(true)
    setRequestComplete(true)
    return {
      photos: [],
      batch: '0',
      noMoreData: true
    }
  }

  const runSearchQuery = async (term, page) => {
    const response = await CONST.gqlClient.query({
      query: FEED_FOR_TEXT_SEARCH,
      variables: {
        searchTerm: term,
        batch: '0',
        pageNumber: page
      }
    })

    const payload = response?.data?.feedForTextSearch || {}
    return {
      photos: payload.photos || [],
      batch: payload.batch ?? '0'
    }
  }

  const applySearchResults = ({ existingPhotos, incomingPhotos, targetPage, batch }) => {
    const reachedEnd = incomingPhotos.length === 0
    setPhotos([...existingPhotos, ...incomingPhotos])
    setPageNumber(targetPage + 1)
    setNoMoreData(reachedEnd)
    setRequestComplete(true)
    return {
      photos: incomingPhotos,
      batch,
      noMoreData: reachedEnd
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

  const renderLoadingIndicator = (label) => (
    <div className='infinite-scroll-loader' aria-label={label}>
      <Bars
        height='40'
        width='40'
        color='#00ff94'
        ariaLabel='spinner-loading-indicator'
        wrapperStyle={{}}
        wrapperClass=''
        visible
      />
    </div>
  )

  useEffect(() => {
    setSearchText(searchString || '')

    const sanitizedTerm = (searchString || '').trim()

    if (!sanitizedTerm) {
      setActiveSearchTerm('')
      setPhotos([])
      setPageNumber(0)
      setNoMoreData(true)
      setRequestComplete(true)
      return
    }

    setPhotos([])
    setPageNumber(0)
    setNoMoreData(true)
    setActiveSearchTerm(sanitizedTerm)
  }, [searchString])

  useEffect(() => {
    if (!activeSearchTerm) return

    const initSearch = async () => {
      setRequestComplete(false)

      ReactGA.send({
        hitType: 'pageview',
        page: `/search/${activeSearchTerm}`
      })

      await retrievePhotos({ reset: true, searchTerm: activeSearchTerm })
    }

    initSearch()
  }, [activeSearchTerm])

  const retrievePhotos = async ({ reset = false, searchTerm = activeSearchTerm } = {}) => {
    if (!searchTerm) {
      setRequestComplete(true)
      return handleSearchFailure(reset)
    }

    const { targetPage, existingPhotos } = derivePaginationState(reset, pageNumber, photos)

    try {
      const { photos: incomingPhotos, batch } = await runSearchQuery(searchTerm, targetPage)
      return applySearchResults({
        existingPhotos,
        incomingPhotos,
        targetPage,
        batch
      })
    } catch (err) {
      console.error('Error retrieving search photos:', err.message)
      return handleSearchFailure(reset)
    }
  }

  const renderInfiniteFeed = function () {
    return (
      <InfiniteScroll
        key={activeSearchTerm || 'search-feed'}
        style={{
          position: 'relative',
          overflow: 'unset'
        }}
        dataLength={photos.length} // This is important field to render the next data
        next={() => retrievePhotos()}
        hasMore={!noMoreData}
        loader={renderLoadingIndicator('Loading more content')}
        endMessage={
          <p style={{ textAlign: 'center' }}>
            <b>Yay! You have seen it all</b>
          </p>
        }
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
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  overflow: 'hidden'
                }}
                key={photo.id}
              >
                <Link
                  to={`/${photo?.video === true ? 'videos' : 'photos'}/${encodeURIComponent(photo.id)}`}
                  style={{
                    width: '100%',
                    display: 'block'
                  }}
                >
                  {photo?.lastComment && (
                    <>
                      <div style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'block',
                        width: '100%',
                        lineHeight: 0
                      }}
                      >
                        <img
                          src={photo.thumbUrl}
                          width={thumbDimensions.width}
                          height={thumbDimensions.height}
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
                      </div>
                      <div style={{ width: '100%', paddingBottom: 15 }}>
                        {/* Truncate the comment to prevent potential XSS */}
                        {photo?.lastComment.substring(0, 150)}
                      </div>
                    </>
                  )}
                  {!photo?.lastComment && (
                    <div
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'block',
                        lineHeight: 0
                      }}
                    >
                      <img
                        src={photo.thumbUrl}
                        width={thumbDimensions.width}
                        height={thumbDimensions.height}
                        loading='lazy'
                        style={{
                          width: '100%',
                          display: 'block',
                          margin: 0,
                          padding: 0
                        }}
                        alt={`Photo ${photo.id}`}
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.src = '/logo192.png' // Fallback image
                        }}
                      />
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

  if (requestComplete) {
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
          {searchString && (
            <h1 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              lineHeight: '1.2',
              marginBottom: '1rem'
            }}
            >Search results for: {searchString}
            </h1>
          )}

          {renderSearchComponent()}

          {/* Show message when no search string provided */}
          {!searchString && (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <h2>Search WiSaw</h2>
              <p>Enter a search term to find photos and videos</p>
            </div>
          )}

          {/* Show "nothing found" only when we have a search string but no results */}
          {searchString && photos?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <h2>Nothing found</h2>
              <p>Try adjusting your search terms</p>
            </div>
          )}

          {photos?.length > 0 && renderInfiniteFeed()}

          <Helmet prioritizeSeoTags>
            <title>{searchString ? `WiSaw: searching for ${searchString}` : 'WiSaw: Search Photos and Videos'}</title>
            <link
              rel='canonical'
              href={searchString ? `https://wisaw.com/search/${searchString}` : 'https://wisaw.com/search'}
            />
            <meta
              name='description'
              content={searchString ? `WiSaw: searching for ${searchString}` : 'Search WiSaw for photos and videos'}
            />
            <meta
              property='og:title'
              content={searchString ? `WiSaw: searching for ${searchString}` : 'WiSaw: Search Photos and Videos'}
            />
            <meta
              property='og:description'
              content={searchString ? `WiSaw: searching for ${searchString}` : 'Search WiSaw for photos and videos'}
            />
            <meta name='image' property='og:image' content='' />
            <meta
              property='og:url'
              content={searchString ? `https://wisaw.com/search/${searchString}` : 'https://wisaw.com/search'}
            />
            <meta
              name='twitter:title'
              content={searchString ? `WiSaw: searching for ${searchString}` : 'WiSaw: Search Photos and Videos'}
            />
            <meta
              name='twitter:card'
              content={searchString ? `WiSaw: searching for ${searchString}` : 'WiSaw: Search Photos and Videos'}
            />
            <meta
              name='twitter:description'
              content={searchString ? `WiSaw: searching for ${searchString}` : 'Search WiSaw for photos and videos'}
            />
            <meta name='twitter:image' content='' />
          </Helmet>

          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div className='initial-loading-container'>
      {renderLoadingIndicator('Loading content')}
    </div>
  )
}

export default SearchComponent
