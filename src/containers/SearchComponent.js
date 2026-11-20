/* eslint-disable react/react-in-jsx-scope */
import { lazy, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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
import FeedGrid, { FeedLoader } from './FeedGrid'
import RouteSeo from './RouteSeo'

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

  // Search keeps the term in the alt text; the card itself is the shared layout's (see FeedGrid)
  const altFor = (photo) => photo?.lastComment ||
    (searchString ? `${searchString} - WiSaw` : 'Free stock photo on WiSaw')

  if (requestComplete) {
    return (
      <>
        <FeedGrid
          photos={photos}
          next={() => retrievePhotos()}
          hasMore={!noMoreData}
          scrollKey={activeSearchTerm}
          altFor={altFor}
        >
          {searchString && (
            <h1 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              lineHeight: '1.2',
              marginBottom: '1rem',
              color: 'var(--text-primary)'
            }}
            >Search results for: {searchString}
            </h1>
          )}

          {renderSearchComponent()}

          {/* Show message when no search string provided */}
          {!searchString && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-primary)' }}>
              <h2>Search WiSaw</h2>
              <p>Enter a search term to find photos and videos</p>
            </div>
          )}

          {/* Show "nothing found" only when we have a search string but no results */}
          {searchString && photos?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-secondary)' }}>
              <h2>Nothing found</h2>
              <p>Try adjusting your search terms</p>
            </div>
          )}

          <RouteSeo pathname='/search' term={searchString ?? ''} />
        </FeedGrid>
        <Footer />
      </>
    )
  }

  return (
    <main className='initial-loading-container'>
      <FeedLoader label='Loading content' />
    </main>
  )
}

export default SearchComponent
