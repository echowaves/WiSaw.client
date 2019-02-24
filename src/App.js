import React, { Component, } from "react"

import {
	BrowserRouter as Router, Route, Redirect, Switch, Link,
} from "react-router-dom"
import PhotosComponent from './containers/PhotosComponent'
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
				<Switch>
					<Route exact path="/" component={PhotosComponent} />
					<Route exact path="/photos/:photoId" component={PhotosComponent} />
				</Switch>
			</Router>
		)
	}
}

export default App
