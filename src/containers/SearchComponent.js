import React, { useEffect, useState, lazy } from "react"
import {
  Link,
  useNavigate, useParams
} from "react-router-dom"

const Footer = lazy(() => import("./Footer"))

import { Helmet } from "react-helmet-async"
// import "react-loader-spinner/dist/loader/css/react-spinner-loader.css"
import { Bars } from "react-loader-spinner"

import Button from "react-bootstrap/Button"
import Col from "react-bootstrap/Col"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"

import "./PhotosComponent.css"

import ReactGA from "react-ga4"
import Masonry from "react-masonry-component"


// import PropTypes from 'prop-types'
import { gql } from "@apollo/client"
// import stringifyObject from 'stringify-object'
import * as CONST from "../consts"

const SearchComponent = function () {
  const { searchString } = useParams()

  const navigate = useNavigate()

  const [internalState, setInternalState] = useState({
    photos: [],
    requestComplete: false,
  })

  const [searchText, setSearchText] = useState(searchString)
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
  }

  const renderSearchComponent = function () {
    return (
      <div
      style={{
        width: "80%",
        position: "relative",
        alignSelf: "right",
        justifyContent: "right",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "right",
          paddingBottom: "10px",
          paddingTop: "20px",
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
      </div>
    )
  }


  useEffect(() => {
    if (searchString) {
      update({ searchString })
    }
  }, []) // eslint-disable-line

  const { photos, requestComplete } = internalState

  const update = async ({ searchString }) => {    
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
                  imgUrl
                  thumbUrl
                  commentsCount
                  watchersCount
                  lastComment
                  video
                }
                batch
                noMoreData
              }
            }
          `,
          variables: {
            searchTerm: sanitizedSearchString,
            batch: "123123", // Convert to string to avoid potential integer overflow
            pageNumber: 0,
          },
        })
        
        setInternalState({
          photos: response.data.feedForTextSearch.photos || [],
          requestComplete: true,
        })
      } catch (err) {
        console.error("Search error:", err.message) // Use console.error and limit what's logged
        setInternalState({
          photos: [],
          requestComplete: true,
        })
      }
    }
  }

  if (requestComplete ) {
    return (<>
      {renderSearchComponent()}
      <div className='PhotosComponent'>
      {photos?.length === 0 && (<h1>Nothing found</h1>)}
        {photos?.length > 0 && (<Masonry cols={1} gap={10}>
          {photos.map((tile) => (
            <div
              className='crop'
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
              key={tile.id}
            >
              <Link             
                to={`/${tile?.video === true ? 'videos' : 'photos'}/${encodeURIComponent(tile.id)}`}
                style={{
                  alignItems: "center",
                }}
              >
                <img
                  style={{
                    alignItems: "center",
                    maxHeight: "300px",
                    maxWidth: "300px",
                    width: "99%",
                    height: "auto",
                  }}
                  src={tile.thumbUrl}
                  width='300px'
                  height='300px'
                  alt={tile.lastComment || 'Image'}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/logo192.png"; // Fallback image
                  }}
                />
              </Link>
              <div
                style={{
                  padding: 10,
                  marginBottom: 10,
                  lineHeight: "1.2em",
                  height: "auto",
                  textAlign: "center",
                  color: "#555",
                }}
              >
                {/* Use a safer display method for user-generated content */}
                {tile.lastComment ? tile.lastComment.substring(0, 200) : ''}
              </div>
            </div>
          ))}
        </Masonry>)}


        <Helmet prioritizeSeoTags>
          <title>{`WiSaw: searching for ${searchString}`}</title>

          <link
            rel='canonical'
            href={`https://wisaw.com/search/${searchString}`}
          />


          <meta
            name='description'
            content={`WiSaw: searching for ${searchString}`}
          />

          <meta
            property='og:title'
            content={`WiSaw: searching for ${searchString}`}
          />
          <meta
            property='og:description'
            content={`WiSaw: searching for ${searchString}`}
          />
          <meta name='image' property='og:image' content='' />
          <meta
            property='og:url'
            content={`https://wisaw.com/search/${searchString}`}
          />

          <meta
            name='twitter:title'
            content={`WiSaw: searching for ${searchString}`}
          />
          <meta
            name='twitter:card'
            content={`WiSaw: searching for ${searchString}`}
          />
          <meta
            name='twitter:description'
            content={`WiSaw: searching for ${searchString}`}
          />
          <meta name='twitter:image' content='' />
        </Helmet>

        <Footer />
      </div>  
      
      </> 
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
