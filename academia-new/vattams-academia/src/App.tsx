import { Route, Routes } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Home from '@/pages/Home'
import Courses from '@/pages/Courses'
import CourseDetail from '@/pages/CourseDetail'
import Payment from '@/pages/Payment'
import StudentDashboard from '@/pages/StudentDashboard'
import CourseLearn from '@/pages/CourseLearn'
import VerifyCertificate from '@/pages/VerifyCertificate'
import Auth from '@/pages/Auth'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminPayments from '@/pages/admin/AdminPayments'
import AdminCourses from '@/pages/admin/AdminCourses'
import AdminCourseForm from '@/pages/admin/AdminCourseForm'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/pay/:courseId" element={<Payment />} />
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/learn/:slug" element={<CourseLearn />} />
          <Route path="/verify" element={<VerifyCertificate />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route path="/admin/courses/:id" element={<AdminCourseForm />} />
          {/* Exam-taking UI, competitions, materials, assignments, certificate
              issuance etc. are the next build passes — see docs/PHASE-MASTER-MATRIX.md */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
