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
          <Link to='/'>
            <img
              width='55'
              height='55'
              src='/android-chrome-192x192.webp'
              alt='wisaw logo'
            />
          </Link>{" "}
          <span className="logo-text">What I Saw <Link to='/'>#wisaw</Link></span>
        </div>
        
        <div className="hamburger-menu" onClick={toggleMenu}
             onKeyDown={(e) => e.key === 'Enter' && toggleMenu()}
             tabIndex={0}
             role="button"
             aria-label="Menu"
             aria-expanded={menuOpen}>
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
