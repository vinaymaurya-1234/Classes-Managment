import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, ClipboardList, Users } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, Quick, SectionIntro, Stat } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { getChapters } from '../api/chapters.api'
import { getTeacherClasses } from '../api/teacher.api'

export default function TeacherOverviewPage() {
  const { go } = useOutletContext()
  const { token } = useAuth()
  const [chapters, setChapters] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return

    const load = async () => {
      try {
        setLoading(true)
        const [chapterResponse, classResponse] = await Promise.all([
          getChapters(token),
          getTeacherClasses(token),
        ])
        setChapters(chapterResponse.data || [])
        setClasses(classResponse.classes || [])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  const activeChapters = chapters.filter(chapter => chapter.status === 'started')
  const totalStudents = classes.reduce((total, item) => total + item.studentCount, 0)
  const totalSessions = chapters.reduce((total, chapter) => total + (chapter.sessions || 0), 0)
  const currentChapter = activeChapters[0] || chapters[0] || null

  const classSummary = useMemo(
    () => classes.map(item => `${item.className}: ${item.studentCount} students`).join(' · '),
    [classes]
  )

  return <>
    <SectionIntro
      eyebrow="TEACHER"
      title="Ready for today's lessons?"
      text="Your teaching workspace is based on your assigned classes and saved teaching data."
    />

    {loading ? <div className="chapter-loading">Loading your teaching data...</div> : <>
      <div className="stats">
        <Stat icon={BookOpen} label="My chapters" value={chapters.length} detail={`${activeChapters.length} in progress`} />
        <Stat icon={Users} label="My students" value={totalStudents} detail={classSummary || 'No classes assigned'} />
        <Stat icon={CheckCircle2} label="My classes" value={classes.length} detail="Assigned teaching classes" />
        <Stat icon={ClipboardList} label="Sessions logged" value={totalSessions} detail="Saved in your chapters" />
      </div>

      <div className="grid-main">
        <Card title="Current teaching">
          {currentChapter ? <div className="chapter-focus">
            <div className="chapter-icon"><BookOpen size={23} /></div>
            <div>
              <span>{currentChapter.subject.toUpperCase()} · {currentChapter.className.toUpperCase()}</span>
              <h3>{currentChapter.title}</h3>
              <p>Chapter {currentChapter.chapterNumber} · {currentChapter.progress}% completed</p>
            </div>
            <button onClick={() => go('chapters')}>Open</button>
          </div> : <div className="notice-card"><div><h3>No chapter started yet</h3><p>Create or start a chapter from your Chapters page.</p></div></div>}
        </Card>
        <Card title="My classes">
          {classes.length ? <div className="attendance-table">{classes.map(item => <div className="table-row" key={item.className}><div><b>{item.className}</b><small>{item.studentCount} students · {item.subjects.join(', ') || 'No subjects yet'}</small></div><span className="pill success">Assigned</span></div>)}</div> : <div className="notice-card"><div><h3>No classes assigned</h3><p>Your school administrator can assign classes, or create a chapter to establish a teaching class.</p></div></div>}
        </Card>
      </div>

      <div className="quick-grid three">
        <Quick icon={BookOpen} title="Manage chapters" text="Track progress and session notes" onClick={() => go('chapters')} />
        <Quick icon={Users} title="View my classes" text="Filter students by class" onClick={() => go('classes')} />
        <Quick icon={ClipboardList} title="Give homework" text="Open the homework workspace" onClick={() => go('homework')} />
      </div>
    </>}
  </>
}
