import React, { Component, } from "react"
import { withRouter, } from 'react-router-dom'

class Footer extends Component {
	render() {
		const { location, } = this.props
		const embedded = new URLSearchParams(location.search).get("embedded")
		if (embedded) {
			return (<div />)
		}
		return (
			<header
				id="header"
				style={{
					width: '100%',
					textAlign: 'center',
				}}
			>
				<h1
					style={{
						fontFamily: 'verdana',
					}}
				><a href="https://www.wisaw.com">#wisaw</a> -- What I Saw
				</h1>
			</header>
		)
	}
}
export default withRouter(Footer)

// export default Footer
