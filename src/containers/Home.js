/* eslint-disable react/react-in-jsx-scope */
import { useEffect, useState } from 'react'
import { Helmet } from '@dr.pogodin/react-helmet'

import { useNavigate } from 'react-router-dom'

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
import FeedGrid from './FeedGrid'
import RouteSeo from './RouteSeo'

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

  // Feed copy for the alt text; the card itself is the shared layout's (see FeedGrid)
  const altFor = (photo) => photo?.lastComment ||
    (photo?.video === true ? 'Free stock video on WiSaw' : 'Free stock photo on WiSaw')

  return (
    <FeedGrid photos={photos} next={retrievePhotos} hasMore={!noMoreData} altFor={altFor}>
      <RouteSeo pathname='/' />

      <Helmet>
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
    </FeedGrid>
  )
}

export default Home
