import React, { Component } from "react"
import { bounce } from 'react-animations'
import Radium, { StyleRoot } from 'radium'
import useReactRouter from 'use-react-router'

const styles = {
  bounce: {
    animation: 'x 2s',
    animationName: Radium.keyframes(bounce, 'bounce'),
    color: 'red',
    fontWeight: 'bold',
  },
}
const Footer = () => {
  const { history, location, match } = useReactRouter()
  const embedded = new URLSearchParams(location.search).get("embedded")
  if (embedded) {
    return (<div />)
  }
  return (
    <div
      id="footer"
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: '100%',
        textAlign: 'center',
      }}>
      <div style={{
        backgroundColor: 'rgba(245, 245, 245, 0.8)',
      }}>
        <StyleRoot>
          <div
            style={styles.bounce}>
            To incognito-share photos and comments get the app

          </div>
        </StyleRoot>
        <div
          id="stores"
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '5px',
          }}>
          <div
            style={{
              margin: '5px',
            }}>
            <a
              href="http://itunes.apple.com/us/app/wisaw/id1299949122">
              <div>
                <img
                  width="177px"
                  height="56px"
                  alt="wisaw itunes store"
                  src="/appstore.png"
                />
              </div>
            </a>
          </div>
          <div
            style={{
              margin: '5px',
            }}>
            <a
              href="http://play.google.com/store/apps/details?id=com.echowaves.wisaw">
              <div>
                <img
                  width="176px"
                  height="53px"
                  alt="wisaw google play store"
                  src="/googleplay.png"
                />
              </div>
            </a>
          </div>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
        }}>
          <a href="https://www.echowaves.com">© echowaves</a>
					&nbsp;&nbsp;
          <a href="https://www.echowaves.com/support">support</a>
					&nbsp;&nbsp;
          <a href="https://www.echowaves.com/blog">blog</a>
        </div>
      </div>
    </div>
  )
}

export default Footer

// export default Footer
