import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'
import Home from '@/pages/Home'

// Route-level code splitting keeps the initial bundle lean (spec §15) —
// only Home + shell load eagerly; everything else loads on navigation.
const Courses = lazy(() => import('@/pages/Courses'))
const CourseDetail = lazy(() => import('@/pages/CourseDetail'))
const Exams = lazy(() => import('@/pages/Exams'))
const ExamDetail = lazy(() => import('@/pages/ExamDetail'))
const Competitions = lazy(() => import('@/pages/Competitions'))
const CompetitionDetail = lazy(() => import('@/pages/CompetitionDetail'))
const Payment = lazy(() => import('@/pages/Payment'))
const StudentDashboard = lazy(() => import('@/pages/StudentDashboard'))
const CourseLearn = lazy(() => import('@/pages/CourseLearn'))
const VerifyCertificate = lazy(() => import('@/pages/VerifyCertificate'))
const Auth = lazy(() => import('@/pages/Auth'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
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
const AdminExams = lazy(() => import('@/pages/admin/AdminExams'))
const AdminExamForm = lazy(() => import('@/pages/admin/AdminExamForm'))
const AdminCompetitions = lazy(() => import('@/pages/admin/AdminCompetitions'))
const AdminCompetitionForm = lazy(() => import('@/pages/admin/AdminCompetitionForm'))
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

            {/* Canonical + spec-required alias — both resolve the same page
                so neither the site's own links nor the spec's route list
                (§13) ever hit Page Not Found. */}
            <Route path="/exams" element={<Exams />} />
            <Route path="/competitive-exams" element={<Exams />} />
            <Route path="/exams/:slug" element={<ExamDetail />} />

            <Route path="/competitions" element={<Competitions />} />
            <Route path="/competitions/:slug" element={<CompetitionDetail />} />

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
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route path="/pay/:paymentId" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/learn/:slug" element={<ProtectedRoute><CourseLearn /></ProtectedRoute>} />

            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
            <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
            <Route path="/admin/courses/:id" element={<AdminRoute><AdminCourseForm /></AdminRoute>} />
            <Route path="/admin/exams" element={<AdminRoute><AdminExams /></AdminRoute>} />
            <Route path="/admin/exams/:id" element={<AdminRoute><AdminExamForm /></AdminRoute>} />
            <Route path="/admin/competitions" element={<AdminRoute><AdminCompetitions /></AdminRoute>} />
            <Route path="/admin/competitions/:id" element={<AdminRoute><AdminCompetitionForm /></AdminRoute>} />

            {/* Question bank, notifications, audit-log, and analytics admin
                screens are the next build pass — see docs/PHASE-MASTER-MATRIX.md */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}