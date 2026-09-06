import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import type { Material, MaterialType } from '@/types/materials'
import { MATERIAL_TYPES } from '@/types/materials'
import { validateMaterialFile, formatFileSize, isUploadType } from '@/lib/materialValidation'
import {
  createMaterial,
  newMaterialId,
  updateMaterial,
  uploadMaterialFile,
  type UploadResult,
} from '@/lib/materials'
import { UploadCloudIcon } from './MaterialIcons'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export default function MaterialUploadForm({
  courseId,
  existingMaterial,
  adminUid,
  adminName,
  onSaved,
  onCancel,
}: 