import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Home from '@/pages/Home'
import NetworkStatus from '@/components/NetworkStatus'

const Courses = lazy(() => import('@/pages/Courses'))
const Languages = lazy(() => import('@/pages/Languages'))
const CourseDetail = lazy(() => import('@/pages/CourseDetail'))
const Competitions = lazy(() => import('@/pages/Competitions'))
const CompetitiveExams = lazy(() => import('@/pages/CompetitiveExams'))
const Payment = lazy(() => import('@/pages/Payment'))
const StudentDashboard = lazy(() => import('@/pages/StudentDashboard'))
const StudentIdCard = lazy(() => import('@/pages/StudentIdCard'))
const StudentWelcomeLetter = lazy(() => import('@/pages/StudentWelcomeLetter'))
const CourseLearn = lazy(() => import('@/pages/CourseLearn'))
const CompetitionParticipant = lazy(() => import('@/pages/CompetitionParticipant'))
const AssessmentPage = lazy(() => import('@/pages/AssessmentPage'))
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
const UdyamRegistration = lazy(() => import('@/pages/UdyamRegistration'))
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminAssessments = lazy(() => import('@/pages/admin/AdminAssessments'))
const AdminPricingBootstrap = lazy(() => import('@/pages/admin/AdminPricingBootstrap'))
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'))
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses'))
const AdminCompetitions = lazy(() => import('@/pages/admin/AdminCompetitions'))
const AdminCompetitionDetail = lazy(() => import('@/pages/admin/AdminCompetitionDetail'))
const AdminCourseForm = lazy(() => import('@/pages/admin/AdminCourseForm'))
const AdminCourseMaterials = lazy(() => import('@/pages/admin/AdminCourseMaterials'))
const AdminCourseContent = lazy(() => import('@/pages/admin/AdminCourseContent'))
const AdminStudents = lazy(() => import('@/pages/admin/AdminStudents'))
const AdminTutors = lazy(() => import('@/pages/admin/AdminTutors'))
const AdminCertificates = lazy(() => import('@/pages/admin/AdminCertificates'))
const AdminRoute = lazy(() => import('@/components/AdminRoute'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function PrivateRouteSeoGuard() {
  const { pathname } = useLocation()
  const privateRoute =
    pathname === '/login' || pathname === '/register' ||
    pathname.startsWith('/student/') || pathname.startsWith('/tutor/') ||
    pathname.startsWith('/admin') || pathname.startsWith('/dashboard') ||
    pathname.startsWith('/learn/') || pathname.startsWith('/assessment/') ||
    pathname.startsWith('/pay/') || pathname.startsWith('/competition/') ||
    pathname.startsWith('/notifications')
  useSeo({ title: 'VATTAMS ACADEMIA', description: 'Private VATTAMS ACADEMIA application area.', path: pathname, noindex: true, enabled: privateRoute })
  return null
}

function PageFallback() {
  return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" /></div>
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <NetworkStatus />
      <Navbar />
      <main className="flex-1">
        <PrivateRouteSeoGuard />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/languages" element={<Languages />} />
            <Route path="/courses/:slug" element={<CourseDetail />} />
            <Route path="/competitions" element={<Competitions />} />
            <Route path="/competitive-exams" element={<CompetitiveExams />} />
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
            <Route path="/verify" element={<VerifyCertificate />} />
            <Route path="/about" element={<About />} />
            <Route path="/founder" element={<Founder />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/udyam-registration" element={<UdyamRegistration />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/student/register" element={<StudentRegister />} />
            <Route path="/tutor/register" element={<TutorRegister />} />
            <Route path="/tutor/payment" element={<TutorPayment />} />
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
            <Route path="/competition/:slug" element={<CompetitionParticipant />} />
            <Route path="/assessment/:courseId/:assessmentId" element={<AssessmentPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/assessments" element={<AdminRoute><AdminAssessments /></AdminRoute>} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/pricing-bootstrap" element={<AdminRoute><AdminPricingBootstrap /></AdminRoute>} />
            <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
            <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
            <Route path="/admin/competitions" element={<AdminRoute><AdminCompetitions /></AdminRoute>} />
            <Route path="/admin/competitions/:id" element={<AdminRoute><AdminCompetitionDetail /></AdminRoute>} />
            <Route path="/admin/courses/:id" element={<AdminRoute><AdminCourseForm /></AdminRoute>} />
            <Route path="/admin/courses/:id/materials" element={<AdminRoute><AdminCourseMaterials /></AdminRoute>} />
            <Route path="/admin/courses/:id/content" element={<AdminRoute><AdminCourseContent /></AdminRoute>} />
            <Route path="/admin/students" element={<AdminRoute><AdminStudents /></AdminRoute>} />
            <Route path="/admin/tutors" element={<AdminRoute><AdminTutors /></AdminRoute>} />
            <Route path="/admin/certificates" element={<AdminRoute><AdminCertificates /></AdminRoute>} />
            <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}