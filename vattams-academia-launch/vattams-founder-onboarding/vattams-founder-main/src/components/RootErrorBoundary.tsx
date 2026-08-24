import { Component, type ReactNode } from 'react'

// Safety net only — does not change any existing routes/UI/features.
// Without this, any uncaught exception thrown while mounting or rendering
// (e.g. a client SDK failing to initialize because a required env var is
// missing in a given deployment) leaves React's root <div id="root"></div>
// empty, which reads as a blank dark screen against the page's #0B1730
// background. This surfaces something visible + logs the real error to the
// console instead.
export default class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('VATTAMS ACADEMIA — uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-parchment">
          <p className="font-display text-lg font-semibold">Something went wrong loading VATTAMS ACADEMIA.</p>
          <p className="max-w-md text-sm text-slate-muted">
            Please refresh the page. If this keeps happening, contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}