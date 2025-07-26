import { useEffect, useState } from "react"
import ReactGA from "react-ga4"
import { Link, useLocation } from "react-router-dom"
import "./Header.css"

const Header = function () {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  
  useEffect(() => {
    ReactGA.initialize("G-J1W2RB0D7R")
  }, []) // eslint-disable-line

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <header id='header'>
      <div className="header-container">
        <div className="logo-container">
          <Link to='/' className="logo-link">
            <div className="logo-icon">
              <img
                width='48'
                height='48'
                src='/android-chrome-192x192.webp'
                alt='WiSaw logo'
              />
            </div>
            <div className="logo-text-container">
              <span className="logo-title">WiSaw</span>
              <span className="logo-subtitle">What I Saw</span>
            </div>
          </Link>
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
            <li>
              <Link 
                to="/about" 
                className={isActive('/about') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                About
              </Link>
            </li>
            <li>
              <Link 
                to="/contact" 
                className={isActive('/contact') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                Contact
              </Link>
            </li>
            <li>
              <Link 
                to="/terms" 
                className={isActive('/terms') ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                Terms
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Header
