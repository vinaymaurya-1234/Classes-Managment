import { useEffect, useMemo, useState } from 'react'
import { BookOpen, LoaderCircle, Users } from 'lucide-react'
import { Card, SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { getTeacherClasses } from '../api/teacher.api'
import './TeacherClassesPage.css'

export default function TeacherClassesPage() {
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await getTeacherClasses(token)
        setClasses(response.classes || [])
      } catch (err) {
        setError(err.message || 'Unable to load your classes.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  const visibleClasses = useMemo(
    () => selectedClass === 'all' ? classes : classes.filter(item => item.className === selectedClass),
    [classes, selectedClass]
  )

  const totalStudents = visibleClasses.reduce((total, item) => total + item.studentCount, 0)

  return <>
    <SectionIntro
      eyebrow="TEACHING · MY CLASSES"
      title="My Classes"
      text="View students only from the classes assigned to you."
    >
      <div className="teacher-class-select-wrap">
        <span>CLASS</span>
        <select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}>
          <option value="all">All classes</option>
          {classes.map(item => <option key={item.className} value={item.className}>{item.className}</option>)}
        </select>
      </div>
    </SectionIntro>

    {error && <div className="teacher-class-alert">{error}</div>}

    {loading ? (
      <div className="teacher-class-loading"><LoaderCircle size={20} className="spin" /> Loading your classes...</div>
    ) : visibleClasses.length === 0 ? (
      <Card>
        <div className="teacher-class-empty">
          <BookOpen size={30} />
          <h3>No classes assigned yet</h3>
          <p>Create a chapter for Class 10, 11 or 12, or have the school administrator assign a class to your teacher account.</p>
        </div>
      </Card>
    ) : (
      <div className="teacher-class-stack">
        <div className="teacher-class-summary">
          <div><span>SELECTED CLASSES</span><strong>{visibleClasses.length}</strong></div>
          <div><span>STUDENTS</span><strong>{totalStudents}</strong></div>
        </div>

        {visibleClasses.map(classData => <Card key={classData.className} title={classData.className}>
          <div className="teacher-class-meta">
            <span><Users size={15} /> {classData.studentCount} students</span>
            <span><BookOpen size={15} /> {classData.subjects.length ? classData.subjects.join(', ') : 'No subjects added yet'}</span>
          </div>

          {classData.students.length ? (
            <div className="teacher-student-list">
              {classData.students.map(student => <div className="teacher-student-row" key={student.id}>
                {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="teacher-student-avatar image" /> : <span className="teacher-student-avatar">{student.name?.[0] || 'S'}</span>}
                <div className="teacher-student-copy">
                  <strong>{student.name}</strong>
                  <small>{classData.className}{student.email ? ` · ${student.email}` : ''}</small>
                </div>
                <span className="pill success">Active</span>
              </div>)}
            </div>
          ) : (
            <div className="teacher-class-no-students">No students are assigned to {classData.className} yet.</div>
          )}
        </Card>)}
      </div>
    )}
  </>
}
