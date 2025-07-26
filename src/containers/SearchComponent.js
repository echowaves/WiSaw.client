/* eslint-disable react/react-in-jsx-scope */
import { lazy, useEffect, useState } from "react"
import {
  Link,
  useNavigate, useParams
} from "react-router-dom"

const Footer = lazy(() => import("./Footer"))

import { Helmet } from "react-helmet-async"
// import "react-loader-spinner/dist/loader/css/react-spinner-loader.css"
import { Bars } from "react-loader-spinner"

import InfiniteScroll from "react-infinite-scroll-component"

import Button from "react-bootstrap/Button"
import Col from "react-bootstrap/Col"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"

import "./PhotosComponent.css"

import ReactGA from "react-ga4"

// import PropTypes from 'prop-types'
import { gql } from "@apollo/client"
// import stringifyObject from 'stringify-object'
import * as CONST from "../consts"

const SearchComponent = function () {
  const { searchString } = useParams()
  const navigate = useNavigate()

  const [photos, setPhotos] = useState([])
  const [pageNumber, setPageNumber] = useState(0)
  const [noMoreData, setNoMoreData] = useState(true)
  const [requestComplete, setRequestComplete] = useState(false)
  const [searchText, setSearchText] = useState(searchString || "")
  const handleSearch = function (event) {
    if (event) {
      event.preventDefault()
    }
    if (searchText && searchText.trim()) {
      const newSearchTerm = searchText.trim()
      
      // If searching for the same term, just re-run the search
      if (newSearchTerm === searchString) {
        update({ searchString: newSearchTerm })
      } else {
        // Navigate to new search term
        navigate(`/search/${encodeURIComponent(newSearchTerm)}`)
      }
    }
  }
  
  const searchTextHandler = function (event) {
    setSearchText(event.target.value)
  }

  const renderSearchComponent = function () {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "right",
          // alignItems: 'center',
          paddingBottom: "10px",
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
                aria-label="Search input"
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
    // Update searchText state when URL parameter changes
    setSearchText(searchString || "")
    
    if (searchString) {
      update({ searchString })
    } else {
      // If no search string, just show the search form
      setPhotos([])
      setRequestComplete(true)
    }
  }, [searchString]) // Watch searchString parameter changes

  const update = async ({ searchString }) => {    
    // Set loading state
    setPhotos([])
    setPageNumber(0)
    setNoMoreData(true)
    setRequestComplete(false)
    
    ReactGA.send({
      hitType: "pageview",
      page: `/search/${searchString}`,
      // title: "Custom Title",
    })

    if (searchString) {
      try {
        const sanitizedSearchString = searchString.trim();
        const response = await CONST.gqlClient.query({
          query: gql`
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
                }
                batch
                noMoreData
              }
            }
          `,
          variables: {
            searchTerm: sanitizedSearchString,
            batch: "0", // Convert to string to avoid potential integer overflow
            pageNumber: 0,
          },
        })
        
        setPhotos(response.data.feedForTextSearch.photos || [])
        setPageNumber(1)
        setNoMoreData(response.data.feedForTextSearch.noMoreData)
        setRequestComplete(true)
      } catch (err) {
        console.error("Search error:", err.message) // Use console.error and limit what's logged
        setPhotos([])
        setRequestComplete(true)
      }
    }
  }

  const retrieveMorePhotos = async () => {
    if (!searchString) return

    try {
      const sanitizedSearchString = searchString.trim();
      const response = await CONST.gqlClient.query({
        query: gql`
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
              }
              batch
              noMoreData
            }
          }
        `,
        variables: {
          searchTerm: sanitizedSearchString,
          batch: "0",
          pageNumber,
        },
      })

      setPageNumber(pageNumber + 1)
      setNoMoreData(response.data.feedForTextSearch.noMoreData)
      setPhotos([...photos, ...response.data.feedForTextSearch.photos])
      
      return {
        photos: response.data.feedForTextSearch.photos,
        batch: response.data.feedForTextSearch.batch,
        noMoreData: response.data.feedForTextSearch.noMoreData,
      }
    } catch (err) {
      console.error("Error retrieving more photos:", err.message)
      return {
        photos: [],
        batch: "0",
        noMoreData: true
      }
    }
  }

  const renderInfiniteFeed = function () {
    return (
      <InfiniteScroll
        style={{
          position: "relative",
          overflow: 'unset',
        }}
        dataLength={photos.length} //This is important field to render the next data
        next={retrieveMorePhotos}
        hasMore={!noMoreData}
        loader={<div aria-label="Loading content">Loading...</div>}
        endMessage={
          <p style={{ textAlign: "center" }}>
            <b>Yay! You have seen it all</b>
          </p>
        }
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            gap: '10px',
            width: '100%'
          }}
        >
          {photos.map((photo) => (
            <Link
              to={`/${photo?.video === true ? 'videos' : 'photos'}/${encodeURIComponent(photo.id)}`}
              style={{ width: "250px" }}
              key={photo.id}
            >
              {photo?.lastComment && (<><img
                src={photo.thumbUrl}
                style={{  padding: 5 }}
                width={"250px"}
                height="auto"
                alt={photo?.lastComment || `Photo ${photo.id}`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/logo192.png"; // Fallback image
                }}
              />
              <div style={{ width: "250px", paddingBottom: 15 }}>
                {/* Truncate the comment to prevent potential XSS */}
                {photo?.lastComment.substring(0, 150)}
              </div></>
              )}
              {!photo?.lastComment && (<img
                src={photo.thumbUrl}
                style={{padding: 5 }}
                width={"250px"}
                height="auto"
                alt={`Photo ${photo.id}`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/logo192.png"; // Fallback image
                }}
              />
              )}
            </Link>
          ))}
        </div>
      </InfiniteScroll>
    )
  }

  if (requestComplete) {
    return (
      <div
        style={{
          display: "flex",
          width: "100%",
          position: "relative",
          justifyContent: "center",
          // textAlign: 'center',
          // backgroundColor: '#0666a3'
        }}
      >
        <div
          style={{
            // width: '100%',
            maxWidth: "1120px",
            width: "90%",
            position: "relative",
            alignSelf: "center",
            justifyContent: "center",
          }}
        >
          {searchString && (
            <h1 style={{
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: "1.2",
              marginBottom: "1rem"
            }}>Search results for: {searchString}</h1>
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

    <div 
      className='crop'
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      aria-label="Loading content"
    >
      <Bars color='#00BFFF' height={100} width={100} timeout={60000} />      
    </div>

  )
}

export default SearchComponent
