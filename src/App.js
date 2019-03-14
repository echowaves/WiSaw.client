import React, { Component, } from "react"

import {
	BrowserRouter as Router, Route, Switch,
} from "react-router-dom"
import PhotosComponent from './containers/PhotosComponent'
import Footer from './containers/Footer'
import "./App.css"

class App extends Component {
	render() {
		return (
			<Router>
				<div>
					<Switch>
						<Route exact path="/photos/:photoId" component={PhotosComponent} />
						<Route exact path="/" component={PhotosComponent} />
					</Switch>
					<Footer />
				</div>
			</Router>
		)
	}
}

export default App
