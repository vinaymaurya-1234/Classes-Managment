import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import LoginPage from '../pages/LoginPage'
import ProfilePage from '../pages/ProfilePage'
import OverviewPage from '../pages/OverviewPage'
import TimetablePage from '../pages/TimetablePage'
import AttendancePage from '../pages/AttendancePage'
import HomeworkPage from '../pages/HomeworkPage'
import ChaptersPage from '../pages/ChaptersPage'
import FeesPage from '../pages/FeesPage'
import ResultsPage from '../pages/ResultsPage'
import PeoplePage from '../pages/PeoplePage'
import ChildrenPage from '../pages/ChildrenPage'
import NoticesPage from '../pages/NoticesPage'
import { useAuth } from '../context/AuthContext'

export default function AppRouter() {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-loading">Checking your session...</div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={'/' + user.role + '/overview'} replace /> : <LoginPage />} />
      <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to={user ? '/' + user.role + '/overview' : '/login'} replace />} />
        <Route path="/:role/overview" element={<OverviewPage />} />
        <Route path="/:role/timetable" element={<TimetablePage />} />
        <Route path="/:role/attendance" element={<AttendancePage />} />
        <Route path="/:role/homework" element={<HomeworkPage />} />
        <Route path="/:role/chapters" element={<ChaptersPage />} />
        <Route path="/:role/fees" element={<FeesPage />} />
        <Route path="/:role/results" element={<ResultsPage />} />
        <Route path="/:role/students" element={<PeoplePage type="student" />} />
        <Route path="/:role/teachers" element={<PeoplePage type="teacher" />} />
        <Route path="/:role/parents" element={<PeoplePage type="parent" />} />
        <Route path="/:role/classes" element={<PeoplePage type="student" title="My Classes" />} />
        <Route path="/:role/children" element={<ChildrenPage />} />
        <Route path="/:role/notices" element={<NoticesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}