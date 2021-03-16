import React, { Component, } from "react"

import {
	BrowserRouter as Router, Route, Switch,
} from "react-router-dom"
import PhotosComponent from './containers/PhotosComponent'
import NoMatch from './containers/NoMatch'
import Footer from './containers/Footer'
import Header from './containers/Header'
import "./App.css"

class App extends Component {
	render() {
		return (
			<Router>
				<div>
					<Header />
					<Switch>
						<Route exact path="/photos/:photoId" component={PhotosComponent} />
						<Route exact path="/" component={PhotosComponent} />
						<Route component={NoMatch} />
					</Switch>
					<Footer />
				</div>
			</Router>
		)
	}
}

export default App
