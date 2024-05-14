import React, { useEffect, useState } from "react"
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

const Home = function () {
  const [photos, setPhotos] = useState([])
  const [pageNumber, setPageNumber] = useState(0)
  const batch = 0
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
              }
              batch
              noMoreData
            }
          }
        `,
        variables: {
          pageNumber,
          batch,
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
    } catch (err15) {
      // eslint-disable-next-line no-console
      console.log({ err15 }) // eslint-disable-line
    }
  }
  const handleSearch = function () {
    // console.log({event})
    // event.preventDefault()
    navigate(`/search/${searchText}`)

    setSearchText("")
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
                onChange={searchTextHandler}
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
        }}
        dataLength={photos.length} //This is important field to render the next data
        next={retrievePhotos}
        hasMore={!noMoreData}
        loader={<div>Loading...</div>}
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
          {photos.map((photo) => (
            <Link
              to={`/${photo?.video === true ? 'videos' : 'photos'}/${photo.id}`}
              style={{ width: "250px" }}
              key={photo.id}
            >
              <img
                src={photo.thumbUrl}
                style={{ width: "250px", padding: 5 }}
                alt={photo.lastComment}
              />
              <div style={{ width: "250px", paddingBottom: 15 }}>
                {photo.lastComment}
              </div>
            </Link>
          ))}
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
      <div
        style={{
          // width: '100%',
          maxWidth: "1000px",
          width: "90%",
          position: "relative",
          alignSelf: "center",
          justifyContent: "center",
        }}
      >
        <h2
          style={{
            padding: 10,
          }}
        >
          Free Stock Photos and Videos, Royalty Free Stock Images & Copyright Free
          Pictures, User Generated Content, Unaltered, Authentic, Taken With
          Phone Cameras
        </h2>
        {renderSearchComponent()}
        {renderInfiniteFeed()}
      </div>
    </div>
  )
}

export default Home
