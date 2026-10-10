-- Apply explicit upload size/type limits to private Academia storage buckets.
-- Current objects were inspected read-only: course materials are JSON/PDF, and
-- tutor onboarding documents are PDF/JPEG/PNG. Existing objects are untouched.
-- Course content may also include videos and images, so only size is constrained
-- for that bucket to avoid prematurely narrowing future lesson media formats.

UPDATE storage.buckets
SET file_size_limit = 104857600,
    updated_at = now()
WHERE id = 'academia-course-materials';

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ],
    updated_at = now()
WHERE id = 'academia-tutor-onboarding-docs';
