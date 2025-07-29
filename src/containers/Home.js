/* eslint-disable react/react-in-jsx-scope */
import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"

import InfiniteScroll from "react-infinite-scroll-component"
import Masonry from "react-masonry-component"
import {
  Link,
  useNavigate,
} from "react-router-dom"

import Button from "react-bootstrap/Button"
import Col from "react-bootstrap/Col"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"

// import { Helmet } from "react-helmet-async"

// import ReactGA from 'react-ga'
import ReactGA from "react-ga4"

import "./PhotosComponent.css"

// import {
//   Link,
//   useLocation,
//   useParams,
// } from "react-router-dom"

// import PropTypes from 'prop-types'
import { gql } from "@apollo/client"

import * as CONST from "../consts"
import { getOptimizedThumbnailDimensions } from "../utils/imageUtils"

const Home = function () {
  const [photos, setPhotos] = useState([])
  const [pageNumber, setPageNumber] = useState(0)
  const [noMoreData, setNoMoreData] = useState(true)
  const [searchText, setSearchText] = useState("")
  const navigate = useNavigate()

  const init = async () => {
    ReactGA.send({
      hitType: "pageview",
      page: `/`,
      // title: "Custom Title",
    })
  }

  useEffect(() => {
    retrievePhotos()
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          batch: "0", // Convert to string to prevent potential integer overflow
        },
      })

      // console.log({response})
      setPageNumber(pageNumber + 1)
      setNoMoreData(response.data.feedRecent.noMoreData)
      setPhotos([...photos, ...response.data.feedRecent.photos])
      // console.log({pageNumber, noMoreData: response.data.feedRecent.noMoreData})
      return {
        photos: response.data.feedRecent.photos,
        batch: response.data.feedRecent.batch,
        noMoreData: response.data.feedRecent.noMoreData,
      }
    } catch (err) {
      console.error("Error retrieving photos:", err.message)
      return {
        photos: [],
        batch: "0",
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
      setSearchText("")
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

  const renderInfiniteFeed = function () {
    return (
      <InfiniteScroll
        style={{
          position: "relative",
          overflow: 'unset',
        }}
        dataLength={photos.length} //This is important field to render the next data
        next={retrievePhotos}
        hasMore={!noMoreData}
        loader={<div aria-label="Loading content">Loading...</div>}
        endMessage={
          <p style={{ textAlign: "center" }}>
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
        <Masonry style={{}}>
          {photos.map((photo) => {
            const thumbDimensions = getOptimizedThumbnailDimensions(photo)
            
            return (
            <div
              style={{
                borderRadius: "12px",
                backgroundColor: "white",
                margin: "3px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
              key={photo.id}
            >
              <Link
                to={`/${photo?.video === true ? 'videos' : 'photos'}/${encodeURIComponent(photo.id)}`}
                style={{ width: "244px", display: "block", padding: "3px" }}
              >
              {photo?.lastComment && (<>
              <div style={{
                borderRadius: "12px",
                overflow: "hidden",
                display: "block",
                width: "100%",
                lineHeight: 0
              }}>
                <img
                  src={photo.thumbUrl}
                  width={thumbDimensions?.width}
                  height={thumbDimensions?.height}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    objectFit: "cover",
                    margin: 0,
                    padding: 0
                  }}
                  alt={photo?.lastComment || `Photo ${photo.id}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/logo192.png"; // Fallback image
                  }}
                />
              </div>
              <div style={{ width: "100%", paddingBottom: 15 }}>
                {/* Truncate the comment to prevent potential XSS */}
                {photo?.lastComment.substring(0, 150)}
              </div></>
              )}
              {!photo?.lastComment && (
              <div style={{
                borderRadius: "12px",
                overflow: "hidden",
                display: "block",
                width: "100%",
                lineHeight: 0
              }}>
                <img
                  src={photo.thumbUrl}
                  width={thumbDimensions?.width}
                  height={thumbDimensions?.height}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    objectFit: "cover",
                    margin: 0,
                    padding: 0
                  }}
                  alt={`Photo ${photo.id}`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/logo192.png"; // Fallback image
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
        <Helmet prioritizeSeoTags>
        <title>Free Stock Photos & Videos -- What I Saw</title>
        <meta name="description" content="Free Stock Photos and Videos, Royalty Free Stock Images & Copyright Free Pictures, Unaltered, Taken With Phone Cameras, free pictures no copyright" />    
        <link
            rel='canonical'
            href={`https://wisaw.com`}
          />
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://wisaw.com" />
        <meta property="og:title" content="WiSaw - Free Authentic Stock Photos & Videos" />
        <meta property="og:description" content="Discover WiSaw, a community-driven platform for authentic, royalty-free stock photos and videos captured by everyday creators worldwide." />
        <meta property="og:image" content="https://wisaw.com/android-chrome-512x512.png" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://wisaw.com" />
        <meta name="twitter:title" content="WiSaw - Free Authentic Stock Photos & Videos" />
        <meta name="twitter:description" content="Discover WiSaw, a community-driven platform for authentic, royalty-free stock photos and videos captured by everyday creators worldwide." />
        <meta name="twitter:image" content="https://wisaw.com/android-chrome-512x512.png" />
        </Helmet>

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
        <h1 style={{
          fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
          lineHeight: "1.2",
          marginBottom: "1rem"
        }}> Unaltered Photos and Videos, Taken with Phone Cameras.</h1>
        
        <h2 style={{
          fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
          lineHeight: "1.4",
          fontWeight: "400",
          marginBottom: "2rem"
        }}>It&apos;s almost expected that the lighting won&apos;t be perfect and the composition might be off at times, 
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
