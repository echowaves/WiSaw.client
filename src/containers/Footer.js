import React, { Component, } from "react"

class Footer extends Component {
	render() {
		return (
			<div
				id="footer"
				style={{
					position: 'fixed',
					left: 0,
					bottom: 0,
					width: '100%',
					textAlign: 'center',
				}}>
				<div
					id="stores"
					style={{
						display: 'flex',
						justifyContent: 'center',
						padding: '20px',
					}}>
					<div
						style={{
							margin: '20px',
						}}>
						<a
							href="http://itunes.apple.com/us/app/wisaw/id1299949122">
							<div>
								<img
									width="177px"
									height="56px"
									alt="wisaw itunes store"
									src="/appstore.png"
								/>
							</div>
						</a>
					</div>
					<div
						style={{
							margin: '20px',
						}}>
						<a
							href="http://play.google.com/store/apps/details?id=com.echowaves.wisaw">
							<div>
								<img
									width="176px"
									height="53px"
									alt="wisaw google play store"
									src="/googleplay.png"
								/>
							</div>
						</a>
					</div>
				</div>

				<div style={{
					display: 'flex',
					justifyContent: 'center',
				}}>
					<a href="https://www.echowaves.com">© echowaves</a>
					&nbsp;&nbsp;
					<a href="https://www.echowaves.com/support">support</a>
					&nbsp;&nbsp;
					<a href="https://www.echowaves.com/blog">blog</a>
				</div>

			</div>
		)
	}
}

export default Footer
