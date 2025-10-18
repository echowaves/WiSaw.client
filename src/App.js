/* eslint-disable react/react-in-jsx-scope */
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

// import logo from './logo.svg'
import { HelmetProvider } from 'react-helmet-async'
import './App.css'
const Home = lazy(() => import('./containers/Home'))
const PhotosComponent = lazy(() => import('./containers/PhotosComponent'))
const SearchComponent = lazy(() => import('./containers/SearchComponent'))
const NoMatch = lazy(() => import('./containers/NoMatch'))
const Header = lazy(() => import('./containers/Header'))
const About = lazy(() => import('./containers/About'))
const Contact = lazy(() => import('./containers/Contact'))
const Terms = lazy(() => import('./containers/Terms'))

function App () {
  return (
    <div className='App'>
      <HelmetProvider>
        <BrowserRouter>
          <Suspense>
            <Header />
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
