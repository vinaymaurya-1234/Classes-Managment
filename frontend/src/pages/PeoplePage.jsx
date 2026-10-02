import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, LoaderCircle, UserPlus, X } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { createUserApi, listUsersApi } from '../api/users.api'
import { students, teachers } from '../data/mockData'

const labels = { student: 'Students', teacher: 'Teachers', parent: 'Parents' }
const descriptions = { student: 'Manage student records and academic details.', teacher: 'Manage faculty and teaching assignments.', parent: 'Manage parent accounts and family contacts.' }

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
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })

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
    if (canManage) return data.filter(item => `${item.name} ${item.email} ${item.phone || ''}`.toLowerCase().includes(query))
    const source = type === 'student' ? students : teachers
    return source.filter(item => item.name.toLowerCase().includes(query))
  }, [canManage, data, search, type])

  const openModal = () => { setForm({ name: '', email: '', password: '', phone: '' }); setError(''); setModalOpen(true) }
  const closeModal = () => { if (!saving) setModalOpen(false) }

  const submit = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await createUserApi(token, { ...form, role: type })
      setModalOpen(false); setForm({ name: '', email: '', password: '', phone: '' }); await loadUsers()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <SectionIntro eyebrow="MANAGEMENT" title={heading} text={descriptions[type] || 'Manage people connected to your tuition centre.'}>
        {canManage && <button className="primary" onClick={openModal}><UserPlus size={16} />Add {type}</button>}
      </SectionIntro>
      {error && !modalOpen && <div className="profile-message error people-error">{error}</div>}
      <Card title={`${heading} directory`}>
        {loading ? <div className="people-state"><LoaderCircle size={18} className="spin" />Loading {heading.toLowerCase()}...</div> : visibleData.length ? (
          <div className="attendance-table">
            {visibleData.map(person => <div className="table-row" key={person.id || person.email || person.name}>
              <span className="person">
                {person.avatarUrl ? <img className="avatar avatar-image" src={person.avatarUrl} alt="" /> : <span className="avatar green">{person.name[0]}</span>}
                <div><b>{person.name}</b><small>{person.className || person.email || (type === 'teacher' ? 'Faculty' : 'Parent account')}</small></div>
              </span>
              <strong>{person.phone || (person.attendance != null ? `${person.attendance}% attendance` : '')}</strong>
              <span className="pill success">Active</span><ChevronRight size={15} />
            </div>)}
          </div>
        ) : <div className="people-state">No {heading.toLowerCase()} found.</div>}
      </Card>
      {modalOpen && <div className="user-modal-backdrop" onMouseDown={closeModal}>
        <div className="user-modal" onMouseDown={event => event.stopPropagation()}>
          <div className="user-modal-head"><div><span className="eyebrow">NEW ACCOUNT</span><h3>Add {type}</h3><p>Create login credentials for this {type}.</p></div><button type="button" className="modal-close" onClick={closeModal} disabled={saving}><X size={18} /></button></div>
          <form onSubmit={submit}>
            <label>Full name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder={type === 'student' ? 'Student name' : type === 'teacher' ? 'Teacher name' : 'Parent name'} required /></label>
            <label>Email address<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" required /></label>
            <label>Temporary password<input type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" required /></label>
            <label>Phone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Optional" /></label>
            {error && <div className="login-error user-modal-error">{error}</div>}
            <div className="user-modal-actions"><button type="button" className="secondary" onClick={closeModal} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? 'Creating...' : 'Create ' + type}</button></div>
          </form>
        </div>
      </div>}
    </>
  )
}