import { useLocation } from "react-router-dom"
import "./Footer.css"

const Footer = function () {
  const location = useLocation()
  const embedded = new URLSearchParams(location.search).get("embedded")
  
  if (embedded) {
    return <div />
  }

  return (
    <footer className="modern-footer">
      <div className="footer-content">
        {/* App Promotion Section */}
        <div className="app-promotion">
          <div className="app-promo-text">
            <h3>Get the Mobile App</h3>
            <p>Share photos and comments privately with the WiSaw mobile app</p>
          </div>
          
          <div className="app-stores">
            <a
              href="http://itunes.apple.com/us/app/wisaw/id1299949122"
              target="_blank" 
              rel="noopener noreferrer"
              className="store-link app-store"
              aria-label="Download WiSaw from App Store"
            >
              <img
                width="156"
                height="52"
                alt="Download on the App Store"
                src="/appstore.webp"
              />
            </a>
            
            <a
              href="http://play.google.com/store/apps/details?id=com.echowaves.wisaw"
              target="_blank" 
              rel="noopener noreferrer"
              className="store-link google-play"
              aria-label="Get WiSaw on Google Play"
            >
              <img
                width="156"
                height="52"
                alt="Get it on Google Play"
                src="/googleplay.webp"
              />
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="footer-divider"></div>

        {/* Links Section */}
        <div className="footer-links">
          <div className="footer-section">
            <h4>Company</h4>
            <div className="link-group">
              <a href="https://www.echowaves.com" target="_blank" rel="noopener noreferrer">
                About Echowaves
              </a>
              <a href="https://www.echowaves.com/blog" target="_blank" rel="noopener noreferrer">
                Blog
              </a>
              <a href="/about">
                About WiSaw
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h4>Support</h4>
            <div className="link-group">
              <a href="https://www.echowaves.com/support" target="_blank" rel="noopener noreferrer">
                Help Center
              </a>
              <a href="/contact">
                Contact Us
              </a>
              <a href="/terms">
                Terms & Privacy
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h4>Community</h4>
            <div className="link-group">
              <a href="/" className="footer-brand">
                WiSaw Gallery
              </a>
              <span className="hashtag">#wisaw</span>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="footer-bottom">
          <div className="copyright">
            <span>© {new Date().getFullYear()} Echowaves. All rights reserved.</span>
          </div>
          <div className="footer-logo">
            <span className="brand-text">WiSaw</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
