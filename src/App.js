import React, { Component, } from "react"

import {
	BrowserRouter, Route, Redirect,
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

	render() {
		const { photoId, } = this.state
		return (
			<BrowserRouter>
				<div>
					{photoId && (
						alert(photoId)
					)}
					{photoId && (
						<Redirect
							to={{
								pathname: `/photos/${photoId}`,
							}}
						/>
					)
					}
					<Route path="/photos/:photoId" component={PhotosComponent} />
				</div>
			</BrowserRouter>
		)
	}

	// 	return (
	// 		<Switch>
	//
	// 		<Route path="/photos/:photoId" component={PhotosComponent} />
	// 		</Switch>
	// 	)
	// }
}

export default App
