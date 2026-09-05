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
const StudentIdCard = lazy(() => import('@/pages/StudentIdCard'))
const StudentWelcomeLetter = lazy(() => import('@/pages/StudentWelcomeLetter'))
const CourseLearn = lazy(() => import('@/pages/CourseLearn'))
const VerifyCertificate = lazy(() => import('@/pages/VerifyCertificate'))
const Auth = lazy(() => import('@/pages/Auth'))
const StudentRegister = lazy(() => import('@/pages/StudentRegister'))
const TutorRegister = lazy(() => import('@/pages/TutorRegister'))
const TutorPayment = lazy(() => import('@/pages/TutorPayment'))
const TutorOnboardingDocuments = lazy(() => import('@/pages/TutorOnboardingDocuments'))
const TutorDashboard = lazy(() => import('@/pages/TutorDashboard'))
const TutorIdCard = lazy(() => import('@/pages/TutorIdCard'))
const TutorOnboardingLetter = lazy(() => import('@/pages/TutorOnboardingLetter'))
const About = lazy(() => import('@/pages/About'))
const Founder = lazy(() => import('@/pages/Founder'))
const Contact = lazy(() => import('@/pages/Contact'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'))
const Terms = lazy(() => import('@/pages/Terms'))
const RefundPolicy = lazy(() => import('@/pages/RefundPolicy'))
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'))
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses'))
const AdminCourseForm = lazy(() => import('@/pages/admin/AdminCourseForm'))
const AdminCourseMaterials = lazy(() => import('@/pages/admin/AdminCourseMaterials'))
const AdminCourseContent = lazy(() => import('@/pages/admin/AdminCourseContent'))
const AdminStudents = lazy(() => import('@/pages/admin/AdminStudents'))
const AdminTutors = lazy(() => import('@/pages/admin/AdminTutors'))
const AdminCertificates = lazy(() => import('@/pages/admin/AdminCertificates'))
const AdminRoute = lazy(() => import('@/components/AdminRoute'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'))
const LiveSession = lazy(() => import('@/pages/LiveSession'))
const TutorLiveSessions = lazy(() => import('@/pages/tutor/TutorLiveSessions'))
const AdminLiveSessions = lazy(() => import('@/pages/admin/AdminLiveSessions'))
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
            <Route path="/competitive-exams" element={<Competitions />} />

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
                        <Route path="/tutor/pay" element={<TutorPayment />} />
            <Route path="/tutor/dashboard" element={<TutorDashboard />} />
            <Route path="/tutor/onboarding-documents" element={<TutorOnboardingDocuments />} />
                        <Route path="/tutor/id-card" element={<TutorIdCard />} />
                        <Route path="/tutor/onboarding-letter" element={<TutorOnboardingLetter />} />
            <Route path="/student/id-card" element={<StudentIdCard />} />
            <Route path="/student/welcome-letter" element={<StudentWelcomeLetter />} />
            <Route path="/learn/:slug" element={<CourseLearn />} />
            <Route path="/notifications" element={<Notifications />} />

            {/* Phase 19 — Live Sessions. /live-session/:sessionId enforces
                its own access control (see LiveSession.tsx + the
                live_sessions rule in firestore.rules), so it isn't
                wrapped in a route guard here. */}
            <Route path="/live-session/:sessionId" element={<LiveSession />} />
            <Route path="/tutor/live-sessions" element={<TutorLiveSessions />} />

            <Route path="/admin" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            {/* Alias for the existing admin login — same component, same
                Supabase-backed `admins` table check. Not linked from any
                public nav; only reachable if you know the URL. */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/courses" element={<AdminCourses />} />
            <Route path="/admin/courses/:id" element={<AdminCourseForm />} />
            {/* Was already fully built (upload/replace/remove, validation,
                progress) but had no <Route> at all — the actual root cause
                of "Course Edit doesn't offer a PDF upload option". See
                AdminCourseForm.tsx's "Course PDF / Study Material" card,
                which links here for the full multi-material manager
                (video/image/notes/link, publish toggle). */}
            <Route
              path="/admin/courses/:id/materials"
              element={
                <AdminRoute>
                  <AdminCourseMaterials />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/courses/:id/content"
              element={
                <AdminRoute>
                  <AdminCourseContent />
                </AdminRoute>
              }
            />

            {/* New in Phase 2 — guarded, unlike the existing /admin/*
                routes above (see components/AdminRoute.tsx). */}
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
              path="/admin/certificates"
              element={
                <AdminRoute>
                  <AdminCertificates />
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
            <Route
              path="/admin/live-sessions"
              element={
                <AdminRoute>
                  <AdminLiveSessions />
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