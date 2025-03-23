import React, { useEffect, useState } from "react"
import ReactGA from "react-ga4"
import { Link } from "react-router-dom"
import "./Header.css"

const Header = function () {
  const [menuOpen, setMenuOpen] = useState(false)
  
  useEffect(() => {
    ReactGA.initialize("G-J1W2RB0D7R")
  }, []) // eslint-disable-line

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  return (
    <header id='header'>
      <div className="header-container">
        <div className="logo-container">
          <a href='/'>
            <img
              width='55'
              height='55'
              src='/android-chrome-192x192.webp'
              alt='wisaw logo'
            />
          </a>{" "}
          <span className="logo-text">What I Saw <a href='/'>#wisaw</a></span>
        </div>
        
        <div className="hamburger-menu" onClick={toggleMenu}>
          <div className={`hamburger-bar ${menuOpen ? 'open' : ''}`}></div>
          <div className={`hamburger-bar ${menuOpen ? 'open' : ''}`}></div>
          <div className={`hamburger-bar ${menuOpen ? 'open' : ''}`}></div>
        </div>
        
        <nav className={`nav-menu ${menuOpen ? 'open' : ''}`}>
          <ul>
            <li><Link to="/about" onClick={() => setMenuOpen(false)}>About</Link></li>
            <li><Link to="/contact" onClick={() => setMenuOpen(false)}>Contact Us</Link></li>
            <li><Link to="/terms" onClick={() => setMenuOpen(false)}>Terms and Policies</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Header
