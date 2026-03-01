/* eslint-disable react/react-in-jsx-scope */
import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import ReactGA from 'react-ga4'

// import logo from './logo.svg'
import './App.css'
const Home = lazy(() => import('./containers/Home'))
const PhotosComponent = lazy(() => import('./containers/PhotosComponent'))
const SearchComponent = lazy(() => import('./containers/SearchComponent'))
const NoMatch = lazy(() => import('./containers/NoMatch'))
const Header = lazy(() => import('./containers/Header'))
const About = lazy(() => import('./containers/About'))
const Contact = lazy(() => import('./containers/Contact'))
const Terms = lazy(() => import('./containers/Terms'))

const THEME_STORAGE_KEY = 'wisaw-theme-mode'
const THEME_COOKIE_KEY = 'wisaw-theme-mode'
const THEME_MODES = ['light', 'dark', 'system']
const GA_TRACKING_ID = 'G-J1W2RB0D7R'

const getCookieValue = (cookieName) => {
  if (typeof document === 'undefined') {
    return null
  }

  const cookiePrefix = `${cookieName}=`
  const matchedCookie = document.cookie
    .split(';')
    .map((cookiePart) => cookiePart.trim())
    .find((cookiePart) => cookiePart.startsWith(cookiePrefix))

  if (!matchedCookie) {
    return null
  }

  try {
    return decodeURIComponent(matchedCookie.slice(cookiePrefix.length))
  } catch {
    return null
  }
}

const setCookieValue = (cookieName, cookieValue) => {
  if (typeof document === 'undefined') {
    return
  }

  const oneYearInSeconds = 60 * 60 * 24 * 365
  document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}; path=/; max-age=${oneYearInSeconds}; SameSite=Lax`
}

const getLocalStorageValue = (storageKey) => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

const setLocalStorageValue = (storageKey, storageValue) => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    window.localStorage.setItem(storageKey, storageValue)
  } catch {
    return null
  }
}

const resolvePersistedThemeMode = () => {
  const themeFromLocalStorage = getLocalStorageValue(THEME_STORAGE_KEY)
  if (THEME_MODES.includes(themeFromLocalStorage)) {
    return themeFromLocalStorage
  }

  const themeFromCookie = getCookieValue(THEME_COOKIE_KEY)
  if (THEME_MODES.includes(themeFromCookie)) {
    return themeFromCookie
  }

  return null
}

const getInitialThemeMode = () => {
  const persistedThemeMode = resolvePersistedThemeMode()
  if (THEME_MODES.includes(persistedThemeMode)) {
    return persistedThemeMode
  }

  return 'system'
}

const App = function () {
  const [themeMode, setThemeMode] = useState(getInitialThemeMode)

  useEffect(() => {
    if (window.__wisawGaInitialized) {
      return
    }

    ReactGA.initialize([
      {
        trackingId: GA_TRACKING_ID,
        gtagOptions: {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false
        }
      }
    ])

    window.__wisawGaInitialized = true
  }, [])

  useEffect(() => {
    const rootElement = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const resolvedTheme = themeMode === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : themeMode

      rootElement.setAttribute('data-theme', resolvedTheme)
      rootElement.setAttribute('data-theme-mode', themeMode)
      rootElement.style.colorScheme = resolvedTheme
    }

    applyTheme()

    if (themeMode !== 'system') {
      return undefined
    }

    const handleSystemThemeChange = () => {
      applyTheme()
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [themeMode])

  useEffect(() => {
    setLocalStorageValue(THEME_STORAGE_KEY, themeMode)
    setCookieValue(THEME_COOKIE_KEY, themeMode)
  }, [themeMode])

  const handleThemeModeChange = (nextThemeMode) => {
    if (THEME_MODES.includes(nextThemeMode)) {
      setThemeMode(nextThemeMode)
    }
  }

  return (
    <div className='App'>
      <HelmetProvider>
        <BrowserRouter>
          <Suspense fallback={
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '100vh',
              fontSize: '1.2rem',
              color: 'var(--accent-light)'
            }}
            >
              Loading...
            </div>
          }
          >
            <Header themeMode={themeMode} onThemeModeChange={handleThemeModeChange} />
            <Routes>
              <Route exact path='/' element={<Home />} />
              <Route
                exact
                path='/photos/:photoId'
                element={<PhotosComponent />}
              />
              <Route
                exact
                path='/videos/:photoId'
                element={<PhotosComponent />}
              />
              <Route
                exact
                path='/search/:searchString'
                element={<SearchComponent />}
              />
              <Route
                exact
                path='/search'
                element={<SearchComponent />}
              />
              <Route path='/about' element={<About />} />
              <Route path='/contact' element={<Contact />} />
              <Route path='/terms' element={<Terms />} />
              <Route element={<NoMatch />} />
              {/* default redirect to home page */}
              <Route path='*' element={<Navigate to='/' />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </HelmetProvider>
    </div>
  )
}

export default App
