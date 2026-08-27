import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { ZoomInIcon, ZoomOutIcon, FullscreenIcon } from './MaterialIcons'

// Responsive image lightbox — zoom via buttons or mouse wheel, pan by
// dragging (mouse) or one-finger drag (touch) once zoomed in. Built on
// pointer events (no gesture/zoom library) so it works the same way
// across mouse and touch without an extra dependency.
export default function ImageViewer({ url, title }: { url: string; title: string }) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  )
  const containerRef = useRef<HTMLDivElement>(null)

  function clampZoom(z: number) {
    return Math.min(4, Math.max(1, z))
  }

  function zoomIn() {
    setZoom((z) => clampZoom(+(z + 0.5).toFixed(2)))
  }
  function zoomOut() {
    setZoom((z) => {
      const next = clampZoom(+(z - 0.5).toFixed(2))
      if (next === 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }
  function resetZoom() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen?.().catch(() => {})
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (zoom === 1) return
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset({ x: dragState.current.originX + dx, y: dragState.current.originY + dy })
  }
  function onPointerUp() {
    dragState.current = null
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col bg-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-navy-dark px-3 py-2">
        <p className="truncate text-sm text-slate-muted">{title}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={zoomOut} className="rounded-card p-1.5 text-parchment/80 hover:bg-white/10" aria-label="Zoom out">
            <ZoomOutIcon />
          </button>
          <button type="button" onClick={resetZoom} className="w-10 text-center text-xs text-slate-muted hover:text-parchment">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={zoomIn} className="rounded-card p-1.5 text-parchment/80 hover:bg-white/10" aria-label="Zoom in">
            <ZoomInIcon />
          </button>
          <button type="button" onClick={toggleFullscreen} className="rounded-card p-1.5 text-parchment/80 hover:bg-white/10" aria-label="Toggle fullscreen">
            <FullscreenIcon />
          </button>
        </div>
      </div>

      <div
        className="flex flex-1 touch-none items-center justify-center overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        <img
          src={url}
          alt={title}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transition: dragState.current ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      <p className="border-t border-white/10 bg-navy-dark px-3 py-1.5 text-center text-[11px] text-slate-muted sm:hidden">
        Pinch or use the zoom buttons above · drag to pan
      </p>
    </div>
  )
}
