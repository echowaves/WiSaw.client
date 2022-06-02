import React, { lazy, Suspense } from "react"

import {
  BrowserRouter as Router, Route, Switch,
} from "react-router-dom"

import "./App.css"

const PhotosComponent = lazy(() => import('./containers/PhotosComponent'))
const SearchComponent = lazy(() => import('./containers/SearchComponent'))

const NoMatch = lazy(() => import('./containers/NoMatch'))
const Footer = lazy(() => import('./containers/Footer'))
const Header = lazy(() => import('./containers/Header'))

const App = () => (
  <Router>
    <Suspense fallback={() => (<div>Loading...</div>)}>
      <Header />
      <Switch>
        <Route exact path="/photos/:photoId" component={PhotosComponent} />
        <Route exact path="/" component={PhotosComponent} />
        <Route exact path="/search/:searchString" component={SearchComponent} />
        <Route component={NoMatch} />
      </Switch>
      <Footer />
    </Suspense>
  </Router>
)
export default App
