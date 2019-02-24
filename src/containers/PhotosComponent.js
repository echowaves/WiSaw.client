import React, { Component, } from "react"
import ReactGA from 'react-ga'

import {
	Link, withRouter,
} from "react-router-dom"

import PropTypes from 'prop-types'

import MetaTags from 'react-meta-tags'

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

	async componentDidMount() {
		let { match: { params: { photoId, }, }, } = this.props
		if (!photoId) {
			try {
				const response = await	fetch(`https://api.wisaw.com/photos/prev/${2147483640}`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				})
				if (response.status === 200) {
					const responseJson = await response.json()
					photoId = responseJson.photo.id
				}
			} catch (error) {
				// console.log(JSON.stringify(error))
			}
		}
		ReactGA.initialize('UA-3129031-19')
		this.update(photoId)
	}

	update(photoId) {
		ReactGA.pageview(`/photos/${photoId}`)
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


		fetch(`https://api.wisaw.com/photos/${photoId}/comments`, {
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
				this.setState({ comments: body.comments, })
			})
			.catch(error => this.setState({ photo: null, }))
	}

	render() {
		const {
			photo, prevPhoto, nextPhoto, comments,
		} = this.state
		const { match: { params: { photoId, }, }, } = this.props

		return (
			<div>
				<MetaTags>
					{comments.length > 0 && (
						<title>{comments[0].comment}</title>
					)}
					<meta property="og:title" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />
					<meta property="og:image" content={`https://s3.amazonaws.com/wisaw-img-prod/${photoId}`} />
					<meta property="og:description" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />
					<meta property="og:url" content={`https://www.wisaw.com/photos/${photoId}`} />
				</MetaTags>

				<div
					style={{
						display: 'flex',
						justifyContent: 'center',
					}}>

					{prevPhoto
					&& (
						<div style={{ margin: '10px', }}>
							<Link
								to={`/photos/${prevPhoto.id}`}
								onClick={() => this.update(prevPhoto.id)}
								replace>prev
							</Link>
						</div>
					)
					}
					{nextPhoto
						&& (
							<div style={{ margin: '10px', }}>
								<Link
									to={`/photos/${nextPhoto.id}`}
									onClick={() => this.update(nextPhoto.id)}
									replace>next
								</Link>
							</div>
						)
					}
				</div>
				<div
					style={{
						display: 'flex',
						justifyContent: 'center',
					}}>
					{photo && (
						<img
							src={photo.getImgUrl}
							alt={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo.id}`}
							style={{
								height: '600px',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						/>
					)}
				</div>
				<div style={{
					display: 'flex',
					justifyContent: 'center',
				}}>
					<div align="center" style={{ margin: '10px', }}>
						{comments && comments.length > 0 && (
							<div>Comments:{comments.length}</div>
						)}
					</div>
					<div align="center" style={{ margin: '10px', }}>
						{photo && photo.likes > 0 && (
							<div>Likes:{photo.likes}</div>
						)}
					</div>
				</div>
				<div style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
				}}>
					{comments && (
						<div align="center" style={{ margin: '10px', }}>

							{comments.map((comment, i) => (
								<div
									key={comment.id}
									style={{ margin: '10', }}>{comment.comment}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		)
	}
}

export default withRouter(PhotosComponent)
