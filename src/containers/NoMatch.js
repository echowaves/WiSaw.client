import React, { Component, } from "react"

import {
	withRouter,
} from "react-router-dom"

import NestedStatus from 'react-nested-status'

class NoMatch extends Component {
	render() {
		const { location, } = this.props
		return (
			<NestedStatus code={404}>
				<div>
					<h2>No match found for <code>{location.pathname}</code></h2>
				</div>
			</NestedStatus>
		)
	}
}

export default withRouter(NoMatch)
