import React, { Component, } from "react"
import { withRouter, } from 'react-router-dom'


class Footer extends Component {
	render() {
		const embedded = new URLSearchParams(this.props.location.search).get("embedded")
		if (embedded) {
			return (<div />)
		}
		return (
			<header
				id="header"
				style={{
					width: '100%',
					textAlign: 'center',
				}}>
				<h1
					style={{
						fontFamily: 'verdana',
					}}>#wisaw -- What I Saw
				</h1>
			</header>
		)
	}
}
export default withRouter(Footer)

// export default Footer
