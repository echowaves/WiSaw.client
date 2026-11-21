import React from 'react'
import { hardReload } from '../utils/bootstrapGuard'
import { releaseStaticFrame } from '../utils/staticFrame'

/**
 * Last line of defence so a failed render never leaves the static fallback markup in
 * #root looking like the whole site. Error boundaries must be class components.
 */
class AppErrorBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError (error) {
    return { error }
  }

  componentDidCatch (error, errorInfo) {
    console.error('Unhandled render error:', error?.message, errorInfo?.componentStack)
    // This panel is the last thing that can still reach the page: no route content is coming, so
    // nothing else will ever hand back index.html's first frame. Left alone it would sit on top of
    // this message — stale chrome with no way to clear it. Only touches #root while that frame is
    // marked, so edge-painted detail markup (which React never owned) survives a late crash.
    releaseStaticFrame()
  }

  handleReload = () => {
    this.setState({ error: null })
    if (!hardReload()) {
      window.location.assign('/')
    }
  }

  render () {
    const { children } = this.props
    const { error } = this.state

    if (!error) {
      return children
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        minHeight: '100vh',
        padding: '24px',
        textAlign: 'center'
      }}
      >
        <h1 style={{ fontSize: '1.4rem' }}>Something went wrong loading this page.</h1>
        <p style={{ maxWidth: '520px', color: 'var(--text-muted, inherit)' }}>
          A new version of WiSaw was probably published while this tab was open.
        </p>
        <button type='button' className='button' onClick={this.handleReload}>
          reload&nbsp;&gt;
        </button>
      </div>
    )
  }
}

export default AppErrorBoundary
