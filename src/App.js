import React, { lazy, Suspense } from "react"

import {
  BrowserRouter, Route, Routes,
} from "react-router-dom"

import "./App.css"

const PhotosComponent = lazy(() => import('./containers/PhotosComponent'))
const SearchComponent = lazy(() => import('./containers/SearchComponent'))

const NoMatch = lazy(() => import('./containers/NoMatch'))
const Footer = lazy(() => import('./containers/Footer'))
const Header = lazy(() => import('./containers/Header'))

const App = () => (
  <BrowserRouter>
    <Suspense fallback={() => (<div>Loading...</div>)}>
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
)
export default App
