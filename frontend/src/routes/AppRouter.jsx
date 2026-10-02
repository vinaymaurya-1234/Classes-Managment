import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
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

export default function AppRouter() {
  return <Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<Navigate to="/principal/overview" replace />} />
      <Route path="/:role/overview" element={<OverviewPage />} />
      <Route path="/:role/timetable" element={<TimetablePage />} />
      <Route path="/:role/attendance" element={<AttendancePage />} />
      <Route path="/:role/homework" element={<HomeworkPage />} />
      <Route path="/:role/chapters" element={<ChaptersPage />} />
      <Route path="/:role/fees" element={<FeesPage />} />
      <Route path="/:role/results" element={<ResultsPage />} />
      <Route path="/:role/students" element={<PeoplePage type="student" />} />
      <Route path="/:role/teachers" element={<PeoplePage type="teacher" />} />
      <Route path="/:role/classes" element={<PeoplePage type="student" title="My Classes" />} />
      <Route path="/:role/children" element={<ChildrenPage />} />
      <Route path="/:role/notices" element={<NoticesPage />} />
      <Route path="*" element={<Navigate to="/principal/overview" replace />} />
    </Route>
  </Routes>
}
