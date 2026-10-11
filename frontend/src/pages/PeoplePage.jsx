import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, LoaderCircle, UserPlus, X } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { createUserApi, listUsersApi } from '../api/users.api'
import { students, teachers } from '../data/mockData'

const labels = { student: 'Students', teacher: 'Teachers', parent: 'Parents' }
const descriptions = { student: 'Manage student records, class and division.', teacher: 'Manage faculty and assign their teaching classes.', parent: 'Manage parent accounts and family contacts.' }
const classOptions = [10, 11, 12].flatMap(std => ['A', 'B', 'C'].map(division => ({ value: `Class ${std} - ${division}`, label: `Class ${std} · Division ${division}` })))

export default function PeoplePage({ type, title }) {
  const { search, role } = useOutletContext()
  const { token } = useAuth()
  const isManagedType = ['student', 'teacher', 'parent'].includes(type)
  const isPrincipal = role === 'principal'
  const canManage = isPrincipal && isManagedType
  const heading = title || labels[type] || 'People'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(canManage)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', std: '', division: 'A', teachingClasses: [] })

  const loadUsers = async () => {
    if (!canManage) return
    setLoading(true); setError('')
    try { const result = await listUsersApi(token, type); setData(result.users || []) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (canManage) loadUsers() }, [canManage, token, type])

  const visibleData = useMemo(() => {
    const query = (search || '').toLowerCase().trim()
    if (canManage) return data.filter(item => `${item.name} ${item.email} ${item.phone || ''} ${item.className || ''} ${item.division || ''} ${(item.teachingClasses || []).join(' ')}`.toLowerCase().includes(query))
    const source = type === 'student' ? students : teachers
    return source.filter(item => item.name.toLowerCase().includes(query))
  }, [canManage, data, search, type])

  const openModal = () => { setForm({ name: '', email: '', password: '', phone: '', std: '', division: 'A', teachingClasses: [] }); setError(''); setModalOpen(true) }
  const closeModal = () => { if (!saving) setModalOpen(false) }
  const toggleClass = value => setForm(current => ({ ...current, teachingClasses: current.teachingClasses.includes(value) ? current.teachingClasses.filter(item => item !== value) : [...current.teachingClasses, value] }))

  const submit = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, ...(type === 'student' ? { std: Number(form.std) } : {}), role: type }
      await createUserApi(token, payload)
      setModalOpen(false); setForm({ name: '', email: '', password: '', phone: '', std: '', division: 'A', teachingClasses: [] }); await loadUsers()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return <>
    <SectionIntro eyebrow="MANAGEMENT" title={heading} text={descriptions[type] || 'Manage people connected to your tuition centre.'}>
      {canManage && <button className="primary" onClick={openModal}><UserPlus size={16} />Add {type}</button>}
    </SectionIntro>
    {error && !modalOpen && <div className="profile-message error people-error">{error}</div>}
    <Card title={`${heading} directory`}>
      {loading ? <div className="people-state"><LoaderCircle size={18} className="spin" />Loading {heading.toLowerCase()}...</div> : visibleData.length ? (
        <div className="attendance-table">
          {visibleData.map(person => {
            const detail = type === 'student'
              ? [person.std ? `Class ${person.std}` : '', person.division ? `Division ${person.division}` : ''].filter(Boolean).join(' · ')
              : type === 'teacher'
                ? (person.teachingClasses || []).join(', ') || 'No classes assigned'
                : person.email || 'Parent account'
            return <div className="table-row" key={person.id || person.email || person.name}>
              <span className="person">
                {person.avatarUrl ? <img className="avatar avatar-image" src={person.avatarUrl} alt="" /> : <span className="avatar green">{person.name?.[0] || 'U'}</span>}
                <div><b>{person.name}</b><small>{detail || person.email}</small></div>
              </span>
              <strong>{person.phone || ''}</strong><span className="pill success">Active</span><ChevronRight size={15} />
            </div>
          })}
        </div>
      ) : <div className="people-state">No {heading.toLowerCase()} found.</div>}
    </Card>
    {modalOpen && <div className="user-modal-backdrop" onMouseDown={closeModal}>
      <div className="user-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="user-modal-head"><div><span className="eyebrow">NEW ACCOUNT</span><h3>Add {type}</h3><p>Create login credentials and academic details.</p></div><button type="button" className="modal-close" onClick={closeModal} disabled={saving}><X size={18} /></button></div>
        <form onSubmit={submit}>
          <label>Full name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder={type === 'student' ? 'Student name' : type === 'teacher' ? 'Teacher name' : 'Parent name'} required /></label>
          <label>Email address<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" required /></label>
          <label>Temporary password<input type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" required /></label>
          <label>Phone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Optional" /></label>
          {type === 'student' && <div className="people-form-grid">
            <label>Class / STD<select value={form.std} onChange={event => setForm({ ...form, std: event.target.value })} required><option value="">Choose class</option>{[10,11,12].map(std => <option key={std} value={std}>Class {std}</option>)}</select></label>
            <label>Division<select value={form.division} onChange={event => setForm({ ...form, division: event.target.value })} required>{['A','B','C'].map(div => <option key={div} value={div}>Division {div}</option>)}</select></label>
          </div>}
          {type === 'teacher' && <fieldset className="teacher-assignment-field"><legend>Assign teaching classes</legend><p>Select every class this teacher will teach.</p><div className="teacher-assignment-options">{classOptions.map(option => <label key={option.value}><input type="checkbox" checked={form.teachingClasses.includes(option.value)} onChange={() => toggleClass(option.value)} />{option.label}</label>)}</div>{!form.teachingClasses.length && <small>Choose at least one class.</small>}</fieldset>}
          {error && <div className="login-error user-modal-error">{error}</div>}
          <div className="user-modal-actions"><button type="button" className="secondary" onClick={closeModal} disabled={saving}>Cancel</button><button className="primary" disabled={saving || (type === 'teacher' && !form.teachingClasses.length)}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? 'Creating...' : 'Create ' + type}</button></div>
        </form>
      </div>
    </div>}
  </>
}
