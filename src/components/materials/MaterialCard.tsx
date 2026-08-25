import type { Material } from '@/types/materials'
import { getMaterialTypeLabel } from '@/types/materials'
import { formatFileSize } from '@/lib/materialValidation'
import { MaterialTypeIcon, ExternalLinkIcon } from './MaterialIcons'

export default function MaterialCard({
  material,
  onOpen,
}: {
  material: Material
  onOpen: (material: Material) => void
}) {
  const isLink = material.type === 'link'
  const dateLabel = material.created_at
    ? new Date(material.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-card bg-gold/15 text-gold">
          <MaterialTypeIcon type={material.type} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-parchment">{material.title}</p>
          <p className="text-xs uppercase tracking-wide text-slate-muted">
            {getMaterialTypeLabel(material.type)}
          </p>
        </div>
      </div>

      {material.description && (
        <p className="line-clamp-2 text-sm text-slate-muted">{material.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-slate-muted">
          {[material.file_size ? formatFileSize(material.file_size) : null, dateLabel]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {isLink ? (
          <a
            href={material.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            Open <ExternalLinkIcon />
          </a>
        ) : (
          <button type="button" onClick={() => onOpen(material)} className="btn-secondary text-xs">
            Open
          </button>
        )}
      </div>
    </div>
  )
}
