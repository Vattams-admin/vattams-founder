import { useRef, useState } from 'react'
import { ZoomInIcon, ZoomOutIcon, FullscreenIcon, ExternalLinkIcon } from './MaterialIcons'

// Renders the PDF via the browser's own built-in PDF viewer (an
// <iframe> pointed at a short-lived signed Supabase Storage download
// URL, obtained through the course-material Edge Function immediately
// before rendering) rather than a bundled viewer library — the brief
// calls for free-first, browser-native APIs where practical, and
// desktop Chrome/Edge/Firefox all render PDFs inline with their own
// page navigation UI for free.
//
// What this component adds on top: a zoom control (CSS transform,
// works regardless of which native viewer the browser uses) and a
// fullscreen toggle. Page navigation is provided by the browser's own
// PDF viewer chrome inside the iframe.
//
// Known limitation (documented, not silently papered over): some
// mobile browsers — notably iOS Safari inside an iframe — don't render
// PDFs inline and may show a blank frame or prompt a download instead.
// The "Open in new tab" link below is the fallback for that case.
export default function PdfViewer({ url, title }: { url: string; title: string }) {
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen?.().catch(() => {})
    }
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col bg-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-navy-dark px-3 py-2">
        <p className="truncate text-sm text-slate-muted">{title}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="rounded-card p-1.5 text-parchment/80 hover:bg-white/10"
            aria-label="Zoom out"
          >
            <ZoomOutIcon />
          </button>
          <span className="w-10 text-center text-xs text-slate-muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
            className="rounded-card p-1.5 text-parchment/80 hover:bg-white/10"
            aria-label="Zoom in"
          >
            <ZoomInIcon />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-card p-1.5 text-parchment/80 hover:bg-white/10"
            aria-label="Toggle fullscreen"
          >
            <FullscreenIcon />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-card px-2 py-1.5 text-xs text-gold hover:text-gold-bright"
          >
            <ExternalLinkIcon /> Open in new tab
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900/40 p-2">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          className="mx-auto min-h-[70vh] w-full"
        >
          <iframe
            src={`${url}#toolbar=1&navpanes=0`}
            title={title}
            className="h-[70vh] w-full rounded-card border-0 bg-white sm:h-[75vh]"
          />
        </div>
      </div>
    </div>
  )
}
