import React, { Component, } from "react"

import {
	BrowserRouter as Router, Route, Redirect, Switch,
} from "react-router-dom"
import PhotosComponent from './containers/PhotosComponent'
import "./App.css"

class App extends Component {
	constructor(props, context) {
		super(props, context)

		this.state = {
			photoId: null,
		}
	}

	componentDidMount() {
		const { photoId, } = this.state
		if (!photoId) {
			fetch('https://api.wisaw.com/photos/prev/2147483640', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			})
				.then(response => {
					if (response.ok) {
						return response.json()
					}
					throw new Error('Something went wrong ...')
				})
				.then(body => {
					this.setState({ photoId: body.photo.id, })
				})
				.catch(error => alert(JSON.stringify(error)))
		}
	}

	render() {
		const { photoId, } = this.state
		return (
			<Router>
				<Switch>
					<Route exact path="/photos/:photoId" component={PhotosComponent} />
					{photoId && (<Redirect from="/" to={`/photos/${photoId}`} />)}
				</Switch>
			</Router>
		)
	}
}

export default App
