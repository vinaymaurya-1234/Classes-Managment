import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, ClipboardList, Loader2, PlayCircle, Plus, Trash2, X } from 'lucide-react'
import { Card, SectionIntro } from '../components/common/UI'
import { createChapter, deleteChapter, getChapters, updateChapter } from '../api/chapters.api'
import './ChaptersPage.css'

const emptyForm = {
  subject: '',
  className: '',
  chapterNumber: '',
  title: '',
}

const formatDate = value => {
  if (!value) return 'Not started'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const statusLabel = status => ({
  'not-started': 'Not started',
  started: 'Started',
  completed: 'Completed',
}[status] || status)

export default function ChaptersPage() {
  const [chapters, setChapters] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadChapters = async (keepSelected = true) => {
    try {
      setLoading(true)
      setError('')
      const response = await getChapters()
      const data = response.data || []
      setChapters(data)
      if (!keepSelected || !data.some(chapter => chapter._id === selectedId)) {
        const current = data.find(chapter => chapter.status === 'started') || data[0]
        setSelectedId(current?._id || null)
      }
    } catch (err) {
      setError(err.message || 'Unable to load chapters.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChapters(false)
  }, [])

  const currentChapter = useMemo(
    () => chapters.find(chapter => chapter._id === selectedId) || null,
    [chapters, selectedId]
  )

  const handleCreate = async event => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      const response = await createChapter({ ...form, chapterNumber: Number(form.chapterNumber) })
      setChapters(prev => [response.data, ...prev])
      setSelectedId(response.data._id)
      setForm(emptyForm)
      setShowForm(false)
    } catch (err) {
      setError(err.message || 'Unable to create chapter.')
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (action, body = {}) => {
    if (!currentChapter) return
    try {
      setSaving(true)
      setError('')
      const response = await updateChapter(currentChapter._id, { action, ...body })
      setChapters(prev => prev.map(item => item._id === response.data._id ? response.data : item))
    } catch (err) {
      setError(err.message || 'Unable to update chapter.')
    } finally {
      setSaving(false)
    }
  }

  const handleSessionNote = async event => {
    event.preventDefault()
    if (!note.trim()) return
    await runAction('session', { note: note.trim() })
    setNote('')
    setShowNote(false)
  }

  const handleDelete = async chapter => {
    if (!window.confirm(`Delete "${chapter.title}"? This cannot be undone.`)) return
    try {
      setSaving(true)
      setError('')
      await deleteChapter(chapter._id)
      const remaining = chapters.filter(item => item._id !== chapter._id)
      setChapters(remaining)
      setSelectedId(remaining[0]?._id || null)
    } catch (err) {
      setError(err.message || 'Unable to delete chapter.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <SectionIntro
      eyebrow="TEACHING · CHAPTERS"
      title="Chapter progress"
      text="Create chapters for subjects and keep one chapter active until it is completed."
    >
      <button className="primary" onClick={() => { setForm(emptyForm); setShowForm(true) }}>
        <BookOpen size={16} />New chapter
      </button>
    </SectionIntro>

    {error && <div className="chapter-alert" role="alert">{error}</div>}

    {loading ? (
      <div className="chapter-loading"><Loader2 size={20} className="spin" /> Loading chapters...</div>
    ) : chapters.length === 0 ? (
      <Card>
        <div className="chapter-empty">
          <BookOpen size={30} />
          <h3>No chapters yet</h3>
          <p>Create your first chapter to start tracking teaching progress.</p>
          <button className="primary" onClick={() => setShowForm(true)}><Plus size={16} />Create chapter</button>
        </div>
      </Card>
    ) : (
      <div className="chapter-layout">
        <Card title="Current chapter">
          {currentChapter && <div className="active-chapter">
            <div className="chapter-top">
              <div>
                <span>{currentChapter.subject.toUpperCase()} · {currentChapter.className.toUpperCase()}</span>
                <h2>{currentChapter.title}</h2>
                <p>Chapter {currentChapter.chapterNumber} · {currentChapter.startedAt ? `Started ${formatDate(currentChapter.startedAt)}` : 'Not started'}</p>
              </div>
              <span className={`pill ${currentChapter.status === 'started' ? 'success' : 'neutral'}`}>
                {statusLabel(currentChapter.status)}
              </span>
            </div>
            <div className="progress large"><i style={{ width: `${currentChapter.progress}%` }} /></div>
            <div className="chapter-meta">
              <span>{currentChapter.progress}% completed</span>
              <span>{currentChapter.sessions} sessions logged</span>
            </div>
            <div className="chapter-actions">
              {currentChapter.status === 'not-started' && <button className="primary" disabled={saving} onClick={() => runAction('start')}>
                <PlayCircle size={16} />Start chapter
              </button>}
              {currentChapter.status !== 'completed' && <>
                <button className="secondary" disabled={saving} onClick={() => setShowNote(true)}>
                  <ClipboardList size={16} />Add session note
                </button>
                <button className="primary" disabled={saving} onClick={() => runAction('complete')}>
                  <CheckCircle2 size={16} />Mark chapter completed
                </button>
              </>}
              <button className="chapter-delete" disabled={saving} onClick={() => handleDelete(currentChapter)} title="Delete chapter">
                <Trash2 size={16} />
              </button>
            </div>
          </div>}
        </Card>

        <Card title="My chapters">
          <div className="chapter-list">
            {chapters.map(chapter => <button
              key={chapter._id}
              className={`chapter-list-item ${chapter._id === selectedId ? 'selected' : ''}`}
              onClick={() => setSelectedId(chapter._id)}
            >
              <span className="chapter-list-copy">
                <b>{chapter.title}</b>
                <span>{chapter.subject} · {chapter.progress}%</span>
              </span>
              <i className={`pill ${chapter.status === 'started' ? 'success' : 'neutral'}`}>{statusLabel(chapter.status)}</i>
            </button>)}
          </div>
        </Card>
      </div>
    )}

    {showForm && <div className="chapter-modal-backdrop" onMouseDown={() => !saving && setShowForm(false)}>
      <form className="chapter-modal" onSubmit={handleCreate} onMouseDown={event => event.stopPropagation()}>
        <div className="chapter-modal-header"><div><span className="eyebrow">TEACHING</span><h3>New chapter</h3></div><button type="button" className="chapter-close" onClick={() => setShowForm(false)}><X size={18} /></button></div>
        <div className="chapter-form-grid">
          <label>Subject<input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Physics" /></label>
          <label>Class<input required value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} placeholder="Class 12" /></label>
          <label>Chapter number<input required min="1" type="number" value={form.chapterNumber} onChange={e => setForm({ ...form, chapterNumber: e.target.value })} placeholder="4" /></label>
          <label className="full">Chapter title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Electrostatics" /></label>
        </div>
        <div className="chapter-modal-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving...' : 'Create chapter'}</button></div>
      </form>
    </div>}

    {showNote && currentChapter && <div className="chapter-modal-backdrop" onMouseDown={() => !saving && setShowNote(false)}>
      <form className="chapter-modal" onSubmit={handleSessionNote} onMouseDown={event => event.stopPropagation()}>
        <div className="chapter-modal-header"><div><span className="eyebrow">SESSION</span><h3>Add session note</h3></div><button type="button" className="chapter-close" onClick={() => setShowNote(false)}><X size={18} /></button></div>
        <p className="chapter-modal-copy">{currentChapter.title} · Session {currentChapter.sessions + 1}</p>
        <label className="note-field">What was covered?<textarea required rows="5" value={note} onChange={e => setNote(e.target.value)} placeholder="Topics covered, homework given, student observations..." /></label>
        <div className="chapter-modal-actions"><button type="button" className="secondary" onClick={() => setShowNote(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save note'}</button></div>
      </form>
    </div>}
  </>
}
