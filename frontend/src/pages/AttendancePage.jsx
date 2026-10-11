import { ClipboardCheck } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, SectionIntro } from '../components/common/UI'
import PrincipalAttendanceQr from '../components/attendance/PrincipalAttendanceQr'
import StudentAttendanceScanner from '../components/attendance/StudentAttendanceScanner'

export default function AttendancePage() {
 const { role } = useOutletContext()
 if (role === 'principal') return <PrincipalAttendanceQr />
 if (role === 'student') return <StudentAttendanceScanner />
 return <><SectionIntro eyebrow='ATTENDANCE' title={role==='teacher'?'My attendance':'Attendance'} text='Attendance records are shown only when they exist in the school attendance system.'/><Card title='Attendance records'><div className='workflow-empty'><ClipboardCheck size={28}/><strong>No attendance records available</strong><span>This page no longer displays sample student names or fabricated attendance percentages. Student attendance is currently recorded through the principal’s active QR session; teacher attendance records have not yet been configured.</span></div></Card></>
}
