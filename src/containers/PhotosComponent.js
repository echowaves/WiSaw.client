import React, { Component, } from "react"
// import Viewer from 'react-viewer'
// import 'react-viewer/dist/index.css'

import PropTypes from 'prop-types'

class PhotosComponent extends Component {
	static propTypes = {
		match: PropTypes.object.isRequired,
	}

	constructor(props, context) {
		super(props, context)

		this.state = {
			photo: null,
			comments: [],
			nextPhoto: null,
			prevPhoto: null,
		}
	}

	componentDidMount() {
		const { match: { params: { photoId, }, }, } = this.props

		fetch(`https://api.wisaw.com/photos/prev/${photoId}`, {
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
				this.setState({ prevPhoto: body.photo, })
			})
			.catch(error => this.setState({ prevPhoto: null, }))


		fetch(`https://api.wisaw.com/photos/next/${photoId}`, {
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
				this.setState({ nextPhoto: body.photo, })
			})
			.catch(error => this.setState({ nextPhoto: null, }))


		fetch(`https://api.wisaw.com/photos/${photoId}`, {
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
				this.setState({ photo: body.photo, })
			})
			.catch(error => this.setState({ photo: null, }))
	}

	render() {
		const { photo, prevPhoto, nextPhoto, } = this.state

		return (
			<div>
				<div>
					{photo && (
						<img
							src={photo.getImgUrl}
							alt=""
							style={{
								width: 'auto',
								height: '50%',
								position: 'absolute',
								top: 50,
								left: 50,
							}}

						/>
					)}
				</div>
				<div>
					{nextPhoto && (`nextPhoto.id:${nextPhoto.id}. `)}
					{prevPhoto && (`prevPhoto.id:${prevPhoto.id}. `)}
				</div>
			</div>
		)
	}
}

export default PhotosComponent
