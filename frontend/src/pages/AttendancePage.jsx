import { CheckCircle2, QrCode, ChevronRight } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, SectionIntro } from '../components/common/UI'
import { students } from '../data/mockData'
import PrincipalAttendanceQr from '../components/attendance/PrincipalAttendanceQr'
import StudentAttendanceScanner from '../components/attendance/StudentAttendanceScanner'

export default function AttendancePage() {
  const { role } = useOutletContext()

  if (role === 'principal') {
    return <PrincipalAttendanceQr />
  }

  if (role === 'student') {
    return <StudentAttendanceScanner />
  }

  return (
    <>
      <SectionIntro
        eyebrow="ATTENDANCE"
        title="Your lecture attendance"
        text="Confirm your presence for each scheduled lecture."
      >
        <button className="primary">
          <CheckCircle2 size={16} />
          Mark present
        </button>
      </SectionIntro>
      <Card title="Today's attendance">
        <div className="attendance-table">
          {students.map(s => (
            <div className="table-row" key={s.name}>
              <span className="person">
                <span className="avatar green">{s.name[0]}</span>
                <b>{s.name}</b>
              </span>
              <strong>{s.attendance}%</strong>
              <span className="pill success">Present</span>
              <ChevronRight size={15} />
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
