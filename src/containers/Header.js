import React from "react"
import useReactRouter from 'use-react-router'

const Header = () => {
  const { history, location, match } = useReactRouter()

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

// export default Footer
