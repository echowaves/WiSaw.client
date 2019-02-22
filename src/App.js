import React, { Component, } from "react"

import {
	BrowserRouter, Route, Switch, Redirect, Link,
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

	render() {
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


			return <div>Loading</div>
		}

		return (
			<div>
				<BrowserRouter>
					<Route path="/photos/:photoId" component={PhotosComponent} />
				</BrowserRouter>
				<Redirect
					to={{
						pathname: `/photos/${photoId}`,
					}}
				/>
			</div>
		)
	}
}

export default App
