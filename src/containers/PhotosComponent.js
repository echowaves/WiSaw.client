import React, { Component, } from "react"
import ReactGA from 'react-ga'
import "./PhotosComponent.css"

import {
	Link, withRouter,
} from "react-router-dom"

import PropTypes from 'prop-types'
import MetaTags from 'react-meta-tags'
import NoMatch from "./NoMatch.js"

const stringifyObject = require('stringify-object')
const jmespath = require('jmespath')

class PhotosComponent extends Component {
	static propTypes = {
		match: PropTypes.object.isRequired,
	}

	state = {
		photo: null,
		comments: [],
		nextPhoto: null,
		prevPhoto: null,
		noPhotoFound: false,
	}

	componentDidMount() {
		let { match: { params: { photoId, }, }, } = this.props
		if (!photoId) {
			fetch(`https://api.wisaw.com/photos/prev/${2147483640}`, {
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
					photoId = body.photo.id
					ReactGA.initialize('UA-3129031-19')
					this.update(photoId)
				})
				.catch(error =>	console.log(JSON.stringify(error))) // eslint-disable-line no-console
		} else {
			ReactGA.initialize('UA-3129031-19')
			this.update(photoId)
		}
	}

	update(photoId) {
		ReactGA.pageview(`/photos/${photoId}`)
		this.setState({
			photo: null,
			comments: [],
			nextPhoto: null,
			prevPhoto: null,
		})

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
			.catch(error => this.setState({ photo: null, noPhotoFound: true, }))


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
				this.setState({ comments: body.comments.reverse(), })
			})
			.catch(error => this.setState({ photo: null, }))


		fetch(`https://api.wisaw.com/photos/${photoId}/recognitions`, {
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
				this.setState({ recognition: body.recognition, })
			})
			.catch(error => this.setState({ recognition: null, }))
	}

	renderLabel(label) {

	}

	renderRecognitions(recognition) {
		const labels = jmespath.search(recognition, "metaData.Labels[]")
		const textDetections = jmespath.search(recognition, "metaData.TextDetections[?Type=='LINE']")
		const moderationLabels = jmespath.search(recognition, "metaData.ModerationLabels[]")

		return (
			<div>

				{labels.length > 0 && (
					<div>
						<div align="center" style={{ fontWeight: "bold", }}>
					AI recognized tags:
						</div>
						<span align="center">
							{labels.map(label => (
								<div key={label.Name} style={{ fontSize: `${label.Confidence}%`, }}>{stringifyObject(label.Name).replace(/'/g, '')}</div>
							))
							}
						</span>
					</div>
				)}

				{textDetections.length > 0 && (
					<div>
						<div align="center" style={{ fontWeight: "bold", }}>
					AI recognized text:
						</div>
						<span align="center">
							{textDetections.map(text => (
								<div key={text.Id} style={{ fontSize: `${text.Confidence}%`, }}>{stringifyObject(text.DetectedText).replace(/'/g, '')}</div>
							))
							}
						</span>
					</div>
				)}
			</div>
		)
	}

	render() {
		const {
			photo, prevPhoto, nextPhoto, comments, noPhotoFound, recognition,
		} = this.state
		const { match: { params: { photoId, }, }, } = this.props
		if (noPhotoFound) {
			return (
				<NoMatch />
			)
		}
		return (
			<div className="PhotosComponent">
				<MetaTags>
					{comments.length > 0 && (
						<title>{`WiSaw: ${comments[0].comment}`}</title>
					)}
					{comments.length === 0 && (
						<title>{`What I Saw Today photo ${photo ? photo.id : ''}`}</title>
					)}
					<meta property="og:title" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />
					<meta property="og:image" content={`https://s3.amazonaws.com/wisaw-img-prod/${photoId}`} />
					<meta property="og:description" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />
					<meta property="og:url" content={`https://www.wisaw.com/photos/${photoId}`} />
					<meta name="description" content={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo ? photo.id : ''}`} />
					{photoId && (<link rel="canonical" href={`https://www.wisaw.com/photos/${photoId}`} />)}
				</MetaTags>

				<div className="lander">


					{nextPhoto
				&& (
					<div style={{ margin: '10px', }}>
						<Link
							className="button"
							to={`/photos/${nextPhoto.id}`}
							onClick={() => this.update(nextPhoto.id)}>&lt;&nbsp;next
						</Link>
					</div>
				)
					}

					{prevPhoto
				&& (
					<div style={{ margin: '10px', }}>
						<Link
							className="button"
							to={`/photos/${prevPhoto.id}`}
							onClick={() => this.update(prevPhoto.id)}>prev&nbsp;&gt;
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
							className="mainImage"
							src={photo.getImgUrl}
							alt={comments.length > 0 ? comments[0].comment : `wisaw photo ${photo.id}`}
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
						<div align="center" style={{ margin: '10px', paddingBottom: '200px', }}>
							{comments.map((comment, i) => (
								<div key={comment.id}>
									{i === 0 && (
										<h1
											style={{ margin: '10', }}>{comment.comment}
										</h1>
									)}
									{i > 0 && (
										<p
											style={{ margin: '10', }}>{comment.comment}
										</p>
									)}
								</div>
							))}
						</div>
					)}

					{recognition && this.renderRecognitions(recognition)}

					<div align="center" style={{ margin: '10px', paddingBottom: '200px', }} />
				</div>
			</div>
		)
	}
}

export default withRouter(PhotosComponent)
