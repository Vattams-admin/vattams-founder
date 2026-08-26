import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import type { Course } from '@/types/database'
import type { AcademyStudent } from '@/types/academy'

// Firestore has no server-side default like Supabase's
// `encode(gen_random_bytes(6), 'hex')`, so the same 12-hex-char code
// shape is generated here on the client before the write.
function generateCertificateCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const CERTIFICATE_TYPES = ['course_completion', 'competition', 'achievement', 'assessment'] as const
type CertificateType = (typeof CERTIFICATE_TYPES)[number]

interface Certificate {
  id: string
  certificate_code: string
  student_id: string
  student_name: string
  course_id: string | null
  course_name: string | null
  certificate_type: CertificateType
  score: number | null
  issued_at: string
  is_valid: boolean
}

type LoadState = 'loading' | 'loaded' | 'error'

export default function AdminCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [certState, setCertState] = useState<LoadState>('loading')

  const [students, setStudents] = useState<AcademyStudent[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [refState, setRefState] = useState<LoadState>('loading')

  const [studentId, setStudentId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [certificateType, setCertificateType] = useState<CertificateType>('course_completion')
  const [score, setScore] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadCertificates() {
    setCertState('loading')
    try {
      const q = query(collection(firestore, 'certificates'), orderBy('issued_at', 'desc'))
      const snapshot = await getDocs(q)
      setCertificates(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Certificate[])
      setCertState('loaded')
    } catch (err) {
      console.error('Failed to load certificates:', err)
      setCertState('error')
    }
  }

  async function loadReferenceData() {
    setRefState('loading')
    try {
      const [studentSnap, courseSnap] = await Promise.all([
        getDocs(collection(firestore, 'students')),
        getDocs(collection(firestore, 'courses'))
      ])
      const studentRows = studentSnap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          firebase_uid: typeof data.firebase_uid === 'string' ? data.firebase_uid : d.id,
          full_name: typeof data.full_name === 'string' ? data.full_name : '',
          email: typeof data.email === 'string' ? data.email : null
        } as AcademyStudent
      })
      studentRows.sort((a, b) => a.full_name.localeCompare(b.full_name))
      setStudents(studentRows)

      const courseRows = courseSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Course[]
      courseRows.sort((a, b) => a.name.localeCompare(b.name))
      setCourses(courseRows)

      setRefState('loaded')
    } catch (err) {
      console.error('Failed to load students/courses for the certificate form:', err)
      setRefState('error')
    }
  }

  useEffect(() => {
    loadCertificates()
    loadReferenceData()
  }, [])

  const selectedStudent = useMemo(
    () => students.find((s) => s.firebase_uid === studentId) ?? null,
    [students, studentId]
  )
  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId])

  async function issueCertificate() {
    if (!selectedStudent) {
      setError('Choose a student first.')
      return
    }
    setIssuing(true)
    setError(null)
    try {
      const payload = {
        certificate_code: generateCertificateCode(),
        // student_id is the Firebase Auth uid — same identity payments
        // and enrolments key off (user.id) — not the `students`
        // collection's own doc id, so certificate ownership lines up
        // with the rest of the app if a student ever looks these up.
        student_id: selectedStudent.firebase_uid,
        // Denormalized, same pattern as payments/enrolments, so
        // VerifyCertificate.tsx never has to join.
        student_name: selectedStudent.full_name,
        course_id: selectedCourse?.id ?? null,
        course_name: selectedCourse?.name ?? null,
        certificate_type: certificateType,
        score: score.trim() ? Number(score) : null,
        issued_at: new Date().toISOString(),
        is_valid: true
      }
      await addDoc(collection(firestore, 'certificates'), payload)
      setStudentId('')
      setCourseId('')
      setScore('')
      setCertificateType('course_completion')
      await loadCertificates()
    } catch (err) {
      console.error('Failed to issue certificate:', err)
      setError('Unable to issue this certificate right now. Please check your connection and try again.')
    } finally {
      setIssuing(false)
    }
  }

  async function toggleValid(cert: Certificate) {
    setBusyId(cert.id)
    setError(null)
    try {
      await updateDoc(doc(firestore, 'certificates', cert.id), { is_valid: !cert.is_valid })
      setCertificates((prev) => prev.map((c) => (c.id === cert.id ? { ...c, is_valid: !c.is_valid } : c)))
    } catch (err) {
      console.error('Failed to update certificate validity:', err)
      setError('Unable to save that change right now. Please check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="certificates" />
      <h1 className="mt-6 font-display text-3xl">Certificates</h1>
      <p className="mt-2 text-sm text-slate-muted">
        Issue a certificate for a student. The certificate code shown below is what they&apos;ll
        enter on the public verify page.
      </p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="card mt-6 p-5">
        <h2 className="font-display text-lg">Issue a new certificate</h2>

        {refState === 'error' && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">Unable to load students/courses. Please check your connection.</p>
            <button onClick={loadReferenceData} className="btn-secondary text-xs">
              Retry
            </button>
          </div>
        )}

        {refState !== 'error' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Student</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={refState === 'loading'}
                className="input mt-1"
              >
                <option value="">
                  {refState === 'loading' ? 'Loading…' : 'Select a student'}
                </option>
                {students.map((s) => (
                  <option key={s.firebase_uid ?? s.id} value={s.firebase_uid ?? ''}>
                    {s.full_name || s.email || s.firebase_uid || s.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Course (optional)</span>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                disabled={refState === 'loading'}
                className="input mt-1"
              >
                <option value="">
                  {refState === 'loading' ? 'Loading…' : 'No course (e.g. competition/achievement)'}
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Certificate type</span>
              <select
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value as CertificateType)}
                className="input mt-1"
              >
                {CERTIFICATE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Score (optional)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="e.g. 92"
                className="input mt-1"
              />
            </label>
          </div>
        )}

        <button
          onClick={issueCertificate}
          disabled={issuing || refState !== 'loaded' || !studentId}
          className="btn-primary mt-5 disabled:opacity-60"
        >
          {issuing ? 'Issuing…' : 'Issue certificate'}
        </button>
      </div>

      <h2 className="mt-10 font-display text-xl text-gold-bright">Issued certificates</h2>

      {certState === 'error' && (
        <div className="mt-4 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">Unable to connect</p>
          <p className="mt-2 text-sm text-slate-muted">Please check your internet connection and try again.</p>
          <button onClick={loadCertificates} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      )}

      {certState === 'loading' && <p className="mt-4 text-sm text-slate-muted">Loading…</p>}
      {certState === 'loaded' && certificates.length === 0 && (
        <p className="mt-4 text-sm text-slate-muted">No certificates issued yet.</p>
      )}

      <div className="mt-4 space-y-3">
        {certState === 'loaded' &&
          certificates.map((cert) => (
            <div key={cert.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">
                  {cert.student_name} — {cert.course_name ?? cert.certificate_type.replace('_', ' ')}
                </p>
                <p className="text-slate-muted">
                  Code: {cert.certificate_code} · Issued {new Date(cert.issued_at).toLocaleDateString('en-IN')}
                  {cert.score !== null ? ` · Score ${cert.score}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                    cert.is_valid ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                  }`}
                >
                  {cert.is_valid ? 'Valid' : 'Revoked'}
                </span>
                <button
                  onClick={() => toggleValid(cert)}
                  disabled={busyId === cert.id}
                  className="btn-secondary text-xs disabled:opacity-60"
                >
                  {cert.is_valid ? 'Revoke' : 'Reinstate'}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}