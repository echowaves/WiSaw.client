import React, { Component, } from "react"

class PhotosComponent extends Component {
	constructor(props, context) {
		super(props, context)

		this.state = {
			photoId: null,
		}
	}

	componentDidMount() {
		const { match, } = this.props
		const { params, } = match
		const { photoId, } = params
		// alert({ photoId, })
		this.state.photoId = photoId
	}

	render() {
		const { photoId, } = this.state
		if (!photoId) {
			return <div>...Loading...</div>
		}

		return (
			<div>
				{photoId}
			</div>
		)
	}
}

export default PhotosComponent
