import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
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
const StudentRegister = lazy(() => import('@/pages/StudentRegister'))
const TutorRegister = lazy(() => import('@/pages/TutorRegister'))
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
const AdminStudents = lazy(() => import('@/pages/admin/AdminStudents'))
const AdminTutors = lazy(() => import('@/pages/admin/AdminTutors'))
const AdminRoute = lazy(() => import('@/components/AdminRoute'))
const AdminCertificates = lazy(() => import('@/pages/admin/AdminCertificates'))
const AdminCourseMaterials = lazy(() => import('@/pages/admin/AdminCourseMaterials'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
    </div>
  )
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
            <Route path="/courses/:slug" element={<CourseDetail />} />

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
            <Route path="/student/register" element={<StudentRegister />} />
            <Route path="/tutor/register" element={<TutorRegister />} />

            {/* Payment.tsx reads useParams<{ courseId }>() — the param
                name here must match that, not "paymentId". */}
            <Route path="/pay/:courseId" element={<Payment />} />
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/learn/:slug" element={<CourseLearn />} />
            <Route path="/notifications" element={<Notifications />} />

            <Route path="/admin" element={<AdminLogin />} />
            {/* Alias for the existing admin login — same component, same
                Supabase-backed `admins` table check. Not linked from any
                public nav; only reachable if you know the URL. */}
            <Route path="/admin/login" element={<AdminLogin />} />
            {/* All /admin/* routes below are now guarded by AdminRoute —
                previously /admin/payments, /admin/courses and
                /admin/courses/:id rendered for anyone who loaded the URL,
                signed in or not; actual data access still depended on
                Firestore rules, but the page shell itself was reachable.
                AdminCertificates and AdminCourseMaterials existed as files
                with no <Route> at all (dead code, unreachable even for an
                admin) — added here so the "Certificates" link in
                AdminNav.tsx and the course materials workflow resolve
                instead of 404ing. */}
            <Route
              path="/admin/payments"
              element={
                <AdminRoute>
                  <AdminPayments />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <AdminRoute>
                  <AdminCourses />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/courses/:id"
              element={
                <AdminRoute>
                  <AdminCourseForm />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/courses/:id/materials"
              element={
                <AdminRoute>
                  <AdminCourseMaterials />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/certificates"
              element={
                <AdminRoute>
                  <AdminCertificates />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <AdminRoute>
                  <AdminStudents />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/tutors"
              element={
                <AdminRoute>
                  <AdminTutors />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <AdminRoute>
                  <AdminNotifications />
                </AdminRoute>
              }
            />

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