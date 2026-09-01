import { useEffect, useState } from 'react'
import type { Material } from '@/types/materials'
import { createCourseMaterialDownloadUrl } from '@/lib/supabaseStorage'
import { CloseIcon } from './MaterialIcons'
import PdfViewer from './PdfViewer'
import ImageViewer from './ImageViewer'
import VideoPlayer from './VideoPlayer'
import NotesReader from './NotesReader'

export default function MaterialViewerModal({
  material,
  onClose,
}: {
  material: Material
  onClose: () => void
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(
    material.type !== 'notes' && material.type !== 'link'
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSignedUrl() {
      if (
        material.type === 'notes' ||
        material.type === 'link' ||
        !material.storage_path
      ) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const url = await createCourseMaterialDownloadUrl(
          material.storage_path
        )

        if (!cancelled) {
          setSignedUrl(url)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to create material download URL:', err)
          setError(
            'Unable to open this learning material. Please try again.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSignedUrl()

    return () => {
      cancelled = true
    }
  }, [material.type, material.storage_path])

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

        {loading && (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-slate-muted">
              Opening learning material…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="font-medium text-danger">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-secondary mt-4 text-xs"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && material.type === 'pdf' && signedUrl && (
          <PdfViewer url={signedUrl} title={material.title} />
        )}

        {!loading && !error && material.type === 'image' && signedUrl && (
          <ImageViewer url={signedUrl} title={material.title} />
        )}

        {!loading && !error && material.type === 'video' && signedUrl && (
          <VideoPlayer url={signedUrl} title={material.title} />
        )}

        {!loading && !error && material.type === 'notes' && (
          <NotesReader
            title={material.title}
            content={material.content ?? ''}
          />
        )}
      </div>
    </div>
  )
}
