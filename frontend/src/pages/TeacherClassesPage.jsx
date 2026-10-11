import { useEffect, useMemo, useState } from 'react'
import { BookOpen, LoaderCircle, Users, ChevronRight, Search } from 'lucide-react'
import { Card, SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { getTeacherClasses } from '../api/teacher.api'
import './TeacherClassesPage.css'

export default function TeacherClassesPage() {
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let active = true
    const load = async () => {
      try {
        setLoading(true); setError('')
        const response = await getTeacherClasses(token)
        if (!active) return
        const assigned = response.classes || []
        setClasses(assigned)
        setSelectedLabel(current => assigned.some(item => item.label === current) ? current : (assigned[0]?.label || ''))
      } catch (err) { if (active) setError(err.message || 'Unable to load your classes.') }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [token])

  const selected = classes.find(item => item.label === selectedLabel) || null
  const students = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (selected?.students || []).filter(student => `${student.name} ${student.email || ''} ${student.phone || ''}`.toLowerCase().includes(query))
  }, [selected, search])
  const totalStudents = classes.reduce((sum, item) => sum + (item.studentCount || 0), 0)

  return <>
    <SectionIntro eyebrow="TEACHING · MY CLASSES" title="My Classes" text="Open an assigned class to see the students in that division." />
    {error && <div className="teacher-class-alert">{error}</div>}
    {loading ? <div className="teacher-class-loading"><LoaderCircle size={20} className="spin" /> Loading your classes...</div> :
      classes.length === 0 ? <Card><div className="teacher-class-empty"><BookOpen size={30}/><h3>No classes assigned yet</h3><p>Ask the principal to assign one or more classes to your teacher account.</p></div></Card> :
      <>
        <div className="teacher-class-summary">
          <div><span>ASSIGNED CLASSES</span><strong>{classes.length}</strong></div>
          <div><span>TOTAL STUDENTS</span><strong>{totalStudents}</strong></div>
          <div><span>SELECTED CLASS</span><strong>{selected?.label || '—'}</strong></div>
        </div>
        <div className="teacher-class-grid">
          {classes.map(item => <button type="button" key={item.label} className={'teacher-class-tile ' + (selectedLabel === item.label ? 'selected' : '')} onClick={() => { setSelectedLabel(item.label); setSearch('') }}>
            <span className="teacher-class-tile-icon"><BookOpen size={20}/></span>
            <span className="teacher-class-tile-copy"><strong>{item.label || item.className}</strong><small>{item.subjects?.length ? item.subjects.join(' · ') : 'Subjects not added yet'}</small><span><Users size={14}/>{item.studentCount || 0} students</span></span>
            <ChevronRight size={17}/>
          </button>)}
        </div>
        {selected && <Card title={`${selected.label || selected.className} students`}>
          <div className="teacher-student-toolbar"><div><strong>{selected.studentCount || 0} students</strong><span>Students in this assigned class and division</span></div><label><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students"/></label></div>
          {students.length ? <div className="teacher-student-list">{students.map(student => <div className="teacher-student-row" key={student.id}>
            {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="teacher-student-avatar image"/> : <span className="teacher-student-avatar">{student.name?.[0] || 'S'}</span>}
            <div className="teacher-student-copy"><strong>{student.name}</strong><small>{selected.label}{student.email ? ` · ${student.email}` : ''}</small></div>
            {student.phone && <span className="teacher-student-phone">{student.phone}</span>}
          </div>)}</div> : <div className="teacher-class-no-students">{search ? 'No students match your search.' : 'No students are assigned to this class and division yet.'}</div>}
        </Card>}
      </>}
  </>
}
