import React, { useEffect } from 'react'
import ReactGA from 'react-ga'

const Header = () => {
  useEffect(() => {
    ReactGA.initialize('UA-3129031-19')
  }, [])// eslint-disable-line

  // const embedded = new URLSearchParams(location.search).get("embedded")
  // if (embedded) {
  // 	return (<div />)
  // }
  return (
    <header
      id="header"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}>
      <h1
        className="align-baseline"
        style={{
          fontFamily: 'verdana',
          fontSize: '3vmax',
        }}>
        <a href="https://www.wisaw.com">
          <img
            width="55" height="55" src="/android-chrome-192x192.png" alt="wisaw logo"
          />
        </a> What I Saw <a href="https://www.wisaw.com">#wisaw</a>
      </h1>
    </header>
  )
}
export default Header
