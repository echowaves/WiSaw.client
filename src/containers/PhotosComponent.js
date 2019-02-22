import React, { Component, } from "react"
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
			currentPhoto: null,
		}
	}


	componentDidMount() {
		const { match: { params: { photoId, }, }, } = this.props
	}

	render() {
		const { match: { params: { photoId, }, }, } = this.props

		return (
			<div>
				{photoId}
			</div>
		)
	}
}

export default PhotosComponent
