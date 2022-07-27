import React, { lazy, Suspense } from "react"
import { HelmetProvider } from "react-helmet-async"

import {
  BrowserRouter, Route, Routes,
} from "react-router-dom"

import "./App.css"

const lazyWithRetry = (componentImport) => lazy(async () => {
  const pageHasAlreadyBeenForceRefreshed = JSON.parse(
    window.localStorage.getItem(
      'page-has-been-force-refreshed'
    ) || 'false'
  )

  try {
    const component = await componentImport()

    window.localStorage.setItem(
      'page-has-been-force-refreshed',
      'false'
    )

    return component;
  } catch (error) {
    if (!pageHasAlreadyBeenForceRefreshed) {
      // Assuming that the user is not on the latest version of the application.
      // Let's refresh the page immediately.
      window.localStorage.setItem(
        'page-has-been-force-refreshed',
        'true'
      )
      return window.location.reload()
    }

    // The page has already been reloaded
    // Assuming that user is already using the latest version of the application.
    // Let's let the application crash and raise the error.
    throw error
  }
})

const PhotosComponent = lazyWithRetry(() => import('./containers/PhotosComponent'))
const SearchComponent = lazyWithRetry(() => import('./containers/SearchComponent'))

const NoMatch = lazyWithRetry(() => import('./containers/NoMatch'))
const Footer = lazyWithRetry(() => import('./containers/Footer'))
const Header = lazyWithRetry(() => import('./containers/Header'))

const App = () => (
  <HelmetProvider>
    <BrowserRouter>
      <Suspense>
        <Header />
        <Routes>
          <Route exact path="/photos/:photoId" element={<PhotosComponent />} />
          <Route exact path="/" element={<PhotosComponent />} />
          <Route exact path="/search/:searchString" element={<SearchComponent />} />
          <Route element={<NoMatch />} />
        </Routes>
        <Footer />
      </Suspense>
    </BrowserRouter>
  </HelmetProvider>
)
export default App
