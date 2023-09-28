import React, { useEffect } from "react"
import ReactGA from "react-ga4"

const Header = function () {
  useEffect(() => {
    ReactGA.initialize("G-J1W2RB0D7R")
  }, []) // eslint-disable-line

  // const embedded = new URLSearchParams(location.search).get("embedded")
  // if (embedded) {
  // 	return (<div />)
  // }
  return (
    <header
      id='header'
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1
        className='align-baseline'
        style={{
          paddingTop: 10,
          fontFamily: "verdana",
          fontSize: "2vmax",
        }}
      >
        <a href='https://www.wisaw.com'>
          <img
            width='55'
            height='55'
            src='/android-chrome-192x192.webp'
            alt='wisaw logo'
          />
        </a>{" "}
        What I Saw <a href='https://www.wisaw.com'>#wisaw</a>
      </h1>
    </header>
  )
}
export default Header
