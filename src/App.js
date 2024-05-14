/* eslint-disable react/react-in-jsx-scope */
import React, { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"

// import logo from './logo.svg'
import { HelmetProvider } from "react-helmet-async"
import "./App.css"
const Home = lazy(() => import("./containers/Home"))
const PhotosComponent = lazy(() => import("./containers/PhotosComponent"))
const VideosComponent = lazy(() => import("./containers/VideosComponent"))
const SearchComponent = lazy(() => import("./containers/SearchComponent"))

const NoMatch = lazy(() => import("./containers/NoMatch"))
const Header = lazy(() => import("./containers/Header"))

function App() {
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
                path='/photos/:photoId/:fullSize'
                element={<PhotosComponent />}
              />
              <Route
                exact
                path='/photos/:photoId'
                element={<PhotosComponent />}
              />
              <Route
                exact
                path='/videos/:photoId/:fullSize'
                element={<VideosComponent />}
              />
              <Route
                exact
                path='/videos/:photoId'
                element={<VideosComponent />}
              />
              <Route
                exact
                path='/search/:searchString'
                element={<SearchComponent />}
              />
              <Route element={<NoMatch />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </HelmetProvider>
    </div>
  )
}

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.js</code> and save to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React
//         </a>
//       </header>
//     </div>
//   );
// }

export default App
