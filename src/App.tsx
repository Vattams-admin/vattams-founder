import { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Home from '@/pages/Home'

// Route-level code splitting keeps the initial bundle lean — only Home +
// shell load eagerly; everything else loads on navigation.
//
// NOTE: this file previously imported several pages (Competitions,
// CompetitionDetail, Exams, ExamDetail, ProtectedRoute, AdminRoute,
// ForgotPassword, AdminDashboard, AdminExams, AdminExamForm,
// AdminCompetitions, AdminCompetitionForm) that do not exist anywhere in
// this repo, which meant the project could not build. Routes below are
// restricted to pages that actually exist on disk. See the delivery
// report for what a real Competitions build would need.
const Courses = lazy(() => import('@/pages/Courses'))
const CourseDetail = lazy(() => import('@/pages/CourseDetail'))
const Competitions = lazy(() => import('@/pages/Competitions'))
const Payment = lazy(() => import('@/pages/Payment'))
const StudentDashboard = lazy(() => import('@/pages/StudentDashboard'))
const CourseLearn = lazy(() => import('@/pages/CourseLearn'))
const VerifyCertificate = lazy(() => import('@/pages/VerifyCertificate'))
const Auth = lazy(() => import('@/pages/Auth'))
const About = lazy(() => import('@/pages/About'))
const Founder = lazy(() => import('@/pages/Founder'))
const Contact = lazy(() => import('@/pages/Contact'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'))
const Terms = lazy(() => import('@/pages/Terms'))
const RefundPolicy = lazy(() => import('@/pages/RefundPolicy'))
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'))
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'))
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses'))
const AdminCourseForm = lazy(() => import('@/pages/admin/AdminCourseForm'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
    </div>
  )
}

// CourseDetail (src/pages/CourseDetail.tsx) requires a `course` prop — it
// doesn't fetch its own data. This wrapper reads :slug and loads the
// matching course the same way the other slug-keyed public course pages
// already do (Courses.tsx, CourseLearn.tsx): Firestore `courses`
// collection, filtered to `is_published`. Payment.tsx/admin pages load
// courses from Supabase by id instead, but that's a different, id-keyed
// flow — this route mirrors its actual slug-keyed siblings.
function CourseDetailRoute() {
  const { slug } = useParams<{ slug: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'not_found'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')

    if (!slug) {
      setState('not_found')
      return
    }

    async function load() {
      try {
        const courseQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true)
        )
        const snapshot = await getDocs(courseQuery)
        if (cancelled) return

        if (snapshot.empty) {
          setState('not_found')
          return
        }

        const courseDoc = snapshot.docs[0]
        setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course)
        setState('loaded')
      } catch (err) {
        console.error('CourseDetailRoute Firebase error:', err)
        if (cancelled) return
        setState('not_found')
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [slug])

  if (state === 'loading') return <PageFallback />
  if (state === 'not_found' || !course) return <NotFound />

  return <CourseDetail course={course} />
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:slug" element={<CourseDetailRoute />} />

            {/* No competition data source exists yet (no table, no
                collection, no admin UI) — this route is an honest
                "coming soon" placeholder, not the full feature. */}
            <Route path="/competitions" element={<Competitions />} />

            <Route path="/verify-certificate" element={<VerifyCertificate />} />
            <Route path="/verify" element={<VerifyCertificate />} />

            <Route path="/about" element={<About />} />
            <Route path="/founder" element={<Founder />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />

            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />

            {/* Payment.tsx reads useParams<{ courseId }>() — the param
                name here must match that, not "paymentId". */}
            <Route path="/pay/:courseId" element={<Payment />} />
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/learn/:slug" element={<CourseLearn />} />

            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/courses" element={<AdminCourses />} />
            <Route path="/admin/courses/:id" element={<AdminCourseForm />} />

            {/* Exam-taking UI, competitions backend, materials, assignments,
                certificate issuance etc. are the next build passes — see
                docs/PHASE-MASTER-MATRIX.md */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
