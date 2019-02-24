import React, { Component, } from "react"

import {
	BrowserRouter as Router, Route, Switch,
} from "react-router-dom"
import PhotosComponent from './containers/PhotosComponent'
import Footer from './containers/Footer'
import "./App.css"

class App extends Component {
	constructor(props, context) {
		super(props, context)
	}

	componentDidMount() {
	}

	render() {
		return (
			<Router>
				<div>
					<Switch>
						<Route exact path="/" component={PhotosComponent} />
						<Route exact path="/photos/:photoId" component={PhotosComponent} />
					</Switch>
					<Footer />
				</div>
			</Router>
		)
	}
}

export default App
