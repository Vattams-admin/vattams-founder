import { useCallback, useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { firebaseAuth } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'

type Row = {
  assessment_id: string
  course_id: string
  title: string
  domain: string
  kind: string
  status: 'draft' | 'reviewed' | 'published' | 'retired' | string
  question_count: number
  validation_status: 'passed' | 'failed'
  validation_errors: string[]
}

async function adminToken() {
  const user = firebaseAuth.currentUser
  if (!user) throw new Error('Your admin session has expired. Please sign in again.')
  return user.getIdToken()
}

export default function AdminAssessments() {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const call = useCallback(async (action: string, assessmentId?: string) => {
    const token = await adminToken()
    const { data, error: invokeError } = await supabase.functions.invoke('assessment-admin', {
      body: { action, ...(assessmentId ? { assessment_id: assessmentId } : {}) },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (invokeError) throw invokeError
    if (data?.error) {
      const detail = Array.isArray(data.validation_errors) && data.validation_errors.length
        ? `\n\n${data.validation_errors.join('\n')}`
        : ''
      throw new Error(`${data.error}${detail}`)
    }
    return data
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await call('list')
      setRows(Array.isArray(data?.assessments) ? data.assessments : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load assessments.')
    }
  }, [call])

  useEffect(() => { void load() }, [load])

  const action = async (name: string, id: string) => {
    setBusy(`${name}:${id}`)
    setError('')
    try {
      await call(name, id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assessment action failed.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNav active="assessments" />
      <div className="mt-8">
        <p className="text-sm uppercase tracking-[0.3em] text-gold">Assessment Governance</p>
        <h1 className="mt-3 font-display text-4xl">Assessments</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          One secure publishing gate for Courses, Competitive Exams and Competition preparation. Mock tests remain tutor-less and self-learning; the official Competition attempt runtime is isolated.
        </p>
      </div>

      {error && <div className="mt-6 whitespace-pre-line rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="mt-8 overflow-x-auto rounded-card border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-slate-muted">
            <tr>
              {['Assessment','Type','Status','Questions','Validation','Actions'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const key = row.assessment_id
              const validationOk = row.validation_status === 'passed'
              return (
                <tr key={key} className="border-t border-white/10 align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold">{row.title}</p>
                    <p className="mt-1 text-xs text-slate-muted">{row.assessment_id} · {row.course_id}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{row.domain}<br /><span className="text-xs text-slate-muted">{row.kind}</span></td>
                  <td className="px-4 py-4"><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs uppercase">{row.status}</span></td>
                  <td className="px-4 py-4">{row.question_count}</td>
                  <td className="px-4 py-4">
                    <span className={validationOk ? 'text-emerald-300' : 'text-danger'}>{validationOk ? 'PASS' : 'FAIL'}</span>
                    {!validationOk && row.validation_errors?.length > 0 && (
                      <ul className="mt-2 max-w-sm space-y-1 text-xs text-danger">
                        {row.validation_errors.slice(0, 4).map(e => <li key={e}>• {e}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary text-xs" disabled={busy === `validate:${key}`} onClick={() => void action('validate', key)}>Validate</button>
                      {row.status === 'draft' && <button className="btn-secondary text-xs" disabled={!validationOk || busy === `review:${key}`} onClick={() => void action('review', key)}>Mark Reviewed</button>}
                      {row.status === 'reviewed' && <button className="btn-primary text-xs" disabled={!validationOk || busy === `publish:${key}`} onClick={() => void action('publish', key)}>Publish</button>}
                      {row.status === 'published' && <button className="btn-secondary text-xs" disabled={busy === `retire:${key}`} onClick={() => void action('retire', key)}>Retire</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-muted">No assessments are currently registered. This is safe: nothing can be published until reviewed content exists.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
