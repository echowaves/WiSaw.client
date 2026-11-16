/* eslint-disable react/react-in-jsx-scope */
import { Suspense, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import ReactGA from 'react-ga4'

// import logo from './logo.svg'
import './App.css'
import AppErrorBoundary from './containers/AppErrorBoundary'
import { lazyWithRetry } from './utils/lazyWithRetry'
import { clearDetailSkeleton, getDetailSkeleton, skeletonMatchesPath, subscribeDetailSkeleton } from './utils/detailSkeleton'
const Home = lazyWithRetry(() => import('./containers/Home'))
const PhotosComponent = lazyWithRetry(() => import('./containers/PhotosComponent'))
const SearchComponent = lazyWithRetry(() => import('./containers/SearchComponent'))
const NoMatch = lazyWithRetry(() => import('./containers/NoMatch'))
const Header = lazyWithRetry(() => import('./containers/Header'))
const About = lazyWithRetry(() => import('./containers/About'))
const Contact = lazyWithRetry(() => import('./containers/Contact'))
const Terms = lazyWithRetry(() => import('./containers/Terms'))

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
    <AppErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <AppShell themeMode={themeMode} onThemeModeChange={handleThemeModeChange} />
        </BrowserRouter>
      </HelmetProvider>
    </AppErrorBoundary>
  )
}

const renderLoadingFallback = () => (
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
)

// Renders Header and routes. While the server-painted detail skeleton is still
// valid for the current path, the Header is portaled into the skeleton's slot
// so React never reconciles the LCP media node; otherwise it renders normally.
const AppShell = function ({ themeMode, onThemeModeChange }) {
  const location = useLocation()
  // Subscribed (not just read) so a handoff clear - which can come from PhotosComponent when the
  // record kind disagrees with the edge's node - re-renders this shell out of portal mode.
  const skeleton = useSyncExternalStore(subscribeDetailSkeleton, getDetailSkeleton)
  const adopted = Boolean(skeleton && skeletonMatchesPath(skeleton, location.pathname))

  // One-time handoff: the first navigation off the skeleton's detail route
  // hands #root back to React (idempotent with PhotosComponent's own clear).
  // `skeleton` is captured before the first commit, so it only ever goes object -> null
  // (after the clear) and re-running the effect then is a no-op.
  useLayoutEffect(() => {
    if (skeleton && !skeletonMatchesPath(skeleton, location.pathname)) {
      clearDetailSkeleton()
    }
  }, [location.pathname, skeleton])

  // Sticky travel for the portalled Header: while adopted it lives inside the edge's fixed-height
  // header slot, and a sticky element cannot escape its containing block - pinned once at the
  // slot's top, it would scroll away after ~72px instead of travelling the page. display:contents
  // drops the slot's own box (its reserved height stays painted until the handoff clear) so the
  // header's containing block becomes the tall .wsk and it keeps its travel. Cleared with the
  // inline style on handoff; the edge never styles this slot's display, so nothing else competes.
  useEffect(() => {
    if (!adopted || !skeleton) {
      return undefined
    }
    const headerSlot = skeleton.headerSlot
    headerSlot.style.display = 'contents'
    return () => { headerSlot.style.display = '' }
  }, [adopted, skeleton])

  // The .App wrapper lives here (not in App) because adopted mode must switch it to the
  // transparent modifier: #wisaw-app comes after #root in DOM order, and the default .App is an
  // opaque min-height:100vh sheet that would paint over the edge-painted page. Same reason the
  // Suspense fallback is null while adopted - "Loading..." must never cover visible content.
  return (
    <div className={adopted ? 'App App--adopted' : 'App'}>
      <Suspense fallback={adopted ? null : renderLoadingFallback()}>
        {adopted
          ? createPortal(
            <Header themeMode={themeMode} onThemeModeChange={onThemeModeChange} />,
            skeleton.headerSlot
          )
          : <Header themeMode={themeMode} onThemeModeChange={onThemeModeChange} />}
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
    </div>
  )
}

export default App
