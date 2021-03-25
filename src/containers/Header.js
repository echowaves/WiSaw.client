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
        width: '100%',
        textAlign: 'center',
      }}>
      <h1
        style={{
          fontFamily: 'verdana',
          fontSize: '3vmax',
        }}><a href="https://www.wisaw.com">#wisaw</a> -- What I Saw
      </h1>
    </header>
  )
}
export default Header

// export default Footer
