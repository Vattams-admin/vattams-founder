import { Component, type ReactNode } from 'react'

// Safety net for uncaught render/lifecycle failures. Show a concise diagnostic
// so production failures can be fixed without guessing from a generic message.
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
            {this.state.error.message || 'An unexpected rendering error occurred.'}
          </p>
          <details className="max-w-2xl text-left text-xs text-slate-muted">
            <summary className="cursor-pointer">Technical details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
              {this.state.error.stack || this.state.error.message}
            </pre>
          </details>
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
