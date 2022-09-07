import React, { useState, useEffect } from 'react'
import Masonry from 'react-masonry-component'
import InfiniteScroll from 'react-infinite-scroll-component'
import {
  Link,
  // useLocation,
  // useParams,
} from "react-router-dom"

// import { Helmet } from "react-helmet-async"

// import ReactGA from 'react-ga'

import "./PhotosComponent.css"

// import {
//   Link,
//   useLocation,
//   useParams,
// } from "react-router-dom"

// import PropTypes from 'prop-types'
import { gql } from "@apollo/client"

import * as CONST from '../consts'

const Home = function () {
  const [photos, setPhotos] = useState([])
  const [pageNumber, setPageNumber] = useState(0)
  const batch = 0
  const [noMoreData, setNoMoreData] = useState(true)
  
  useEffect(() => {
    // ReactGA.pageview(`/`)
    (async () => {
       await retrievePhotos()                   
      //  setPageNumber(pageNumber+1)                
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // const embedded = new URLSearchParams(location.search).get("embedded")
  const retrievePhotos = async () => {
    try {
      // console.log({pageNumber})        

      const response = (await CONST.gqlClient
        .query({
          query: gql`
        query feedRecent($pageNumber: Int!, $batch: String!) {
          feedRecent(pageNumber: $pageNumber, batch: $batch){
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
            batch,
            noMoreData
          }
        }`,
          variables: {
            pageNumber,
            batch, 
          },
        })) 

        // console.log({response})
        setPageNumber(pageNumber+1)        
        setNoMoreData(response.data.feedRecent.noMoreData)
        setPhotos([...photos, ...response.data.feedRecent.photos ])
        console.log({pageNumber, noMoreData: response.data.feedRecent.noMoreData})        
      return {
        photos: response.data.feedRecent.photos,
        batch: response.data.feedRecent.batch,
        noMoreData: response.data.feedRecent.noMoreData,
      }
    } catch (err15) {
      // eslint-disable-next-line no-console
      console.log({ err15 })// eslint-disable-line
    }  
  }
  return (
      <div
        style={{         
          display: 'flex',
          width: '100%',
          position: 'relative',
          justifyContent: 'center',
          // textAlign: 'center',
          // backgroundColor: '#0666a3'
        }}      
      >
      <div
        style={{         
          // width: '100%',
          maxWidth: '1000px',
          width: '90%',
          position: 'relative',
          alignSelf: 'center',
        }}            
      >
        <InfiniteScroll        
          style={{ 
          }}
          
          dataLength={photos.length} //This is important field to render the next data
          next={retrievePhotos}
          hasMore={!noMoreData}
          loader={<h4>Loading...</h4>}
          
          endMessage={
            <p style={{ textAlign: 'center' }}>
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
            style={{ 
            }}      
            >
              {
                photos.map(photo => (        
                  <Link 
                    to={`/photos/${photo.id}`}
                    style={{ width: '250px'}}
                    key={photo.id}>
                    <img 
                      src={photo.thumbUrl}             
                      style={{ width: '250px', padding: 5,}}
                      alt={photo.lastComment}                      
                    />
                    <div
                      style={{ width: '250px', paddingBottom: 15,}}
                    >
                      {photo.lastComment}
                    </div>
                  </Link>
                ))
              }
            </Masonry>      
          </InfiniteScroll>
        </div>
      </div>
  )
}

export default Home
