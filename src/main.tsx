import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import RootErrorBoundary from './components/RootErrorBoundary'
import './index.css'

// Global safety net for anything that isn't already caught by a component's
// own try/catch or by RootErrorBoundary (which only sees render/lifecycle
// errors, not rejected promises). This logs to the console for debugging —
// it deliberately never writes to the DOM, unlike the previous inline
// diagnostic script that used to live in index.html, which appended raw
// stack traces directly into #root. That approach exposed technical error
// detail to real users and, because it mutated a DOM node React itself
// owns, risked a reconciliation crash the next time React re-rendered.
window.addEventListener('unhandledrejection', (event) => {
  console.error('VATTAMS ACADEMIA — unhandled promise rejection:', event.reason)
})
window.addEventListener('error', (event) => {
  console.error('VATTAMS ACADEMIA — uncaught error:', event.error ?? event.message)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  </React.StrictMode>
)