import { useEffect } from 'react'
import type { Material } from '@/types/materials'
import { CloseIcon } from './MaterialIcons'
import PdfViewer from './PdfViewer'
import ImageViewer from './ImageViewer'
import VideoPlayer from './VideoPlayer'
import NotesReader from './NotesReader'

// Shared modal shell for pdf / image / video / notes materials.
// 'link' materials never open this — they navigate out directly (see
// MaterialCard) since there's nothing of ours to view.
export default function MaterialViewerModal({
  material,
  onClose,
}: {
  material: Material
  onClose: () => void
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={material.title}
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-none border border-white/10 bg-navy shadow-crest sm:h-[90vh] sm:max-w-4xl sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-card bg-ink/70 p-2 text-parchment hover:bg-ink"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        {material.type === 'pdf' && material.url && (
          <PdfViewer url={material.url} title={material.title} />
        )}
        {material.type === 'image' && material.url && (
          <ImageViewer url={material.url} title={material.title} />
        )}
        {material.type === 'video' && material.url && (
          <VideoPlayer url={material.url} title={material.title} />
        )}
        {material.type === 'notes' && (
          <NotesReader title={material.title} content={material.content ?? ''} />
        )}
      </div>
    </div>
  )
}
