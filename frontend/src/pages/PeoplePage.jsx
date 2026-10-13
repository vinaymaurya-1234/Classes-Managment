import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, LoaderCircle, UserPlus, X } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { createUserApi, listUsersApi, updateUserApi } from '../api/users.api'
import { api } from '../api/client'
import { students, teachers } from '../data/mockData'

const labels = { student: 'Students', teacher: 'Teachers', parent: 'Parents' }
const descriptions = {
  student: 'Manage student records, class and division.',
  teacher: 'Manage faculty and assign their teaching classes.',
  parent: 'Manage parent accounts and family contacts.',
}
const emptyForm = () => ({
  name: '',
  email: '',
  password: '',
  phone: '',
  std: '',
  division: 'A',
  teachingClasses: [],
})
const teacherClassOptions = [11, 12].flatMap(std =>
  ['A', 'B', 'C'].map(division => ({
    value: `Class ${std} - ${division}`,
    label: `Class ${std} · Division ${division}`,
  })),
)

export default function PeoplePage({ type, title }) {
  const { search = '', role } = useOutletContext()
  const { token } = useAuth()
  const isManagedType = ['student', 'teacher', 'parent'].includes(type)
  const canManage = role === 'principal' && isManagedType
  const heading = title || labels[type] || 'People'

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(canManage)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const loadUsers = useCallback(async () => {
    if (!canManage || !token) return
    setLoading(true)
    setError('')
    try {
      const result = await listUsersApi(token, type)
      setData(Array.isArray(result.users) ? result.users : [])
    } catch (err) {
      setError(err.message || 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }, [canManage, token, type])

  useEffect(() => {
    if (canManage && token) loadUsers()
  }, [canManage, token, loadUsers])

  const visibleData = useMemo(() => {
    const query = String(search).toLowerCase().trim()
    const source = canManage ? data : (type === 'student' ? students : teachers)
    return source.filter(item =>
      [item.name, item.email, item.phone, item.className, item.std, item.division, ...(item.teachingClasses || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [canManage, data, search, type])

  const openModal = () => {
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (!saving) setModalOpen(false)
  }

  const toggleClass = value => {
    setForm(current => ({
      ...current,
      teachingClasses: current.teachingClasses.includes(value)
        ? current.teachingClasses.filter(item => item !== value)
        : [...current.teachingClasses, value],
    }))
  }

  const submit = async event => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        role: type,
        ...(type === 'student' ? { std: Number(form.std), division: form.division } : {}),
        ...(type === 'teacher' ? { teachingClasses: form.teachingClasses } : {}),
      }
      await createUserApi(token, payload)
      setModalOpen(false)
      setForm(emptyForm())
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to create this account.')
    } finally {
      setSaving(false)
    }
  }

  const updateTeacherClasses = async person => {
    const current = (person.teachingClasses || []).join(', ')
    const input = window.prompt(
      'Enter assigned classes separated by commas. Example: Class 11 - A, Class 12 - B',
      current,
    )
    if (input === null) return
    const teachingClasses = [...new Set(input.split(',').map(value => value.trim()).filter(Boolean))]
    try {
      await updateUserApi(token, person.id, { teachingClasses })
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to update teacher assignments.')
    }
  }

  const updatePlacement = async person => {
    const stdInput = window.prompt('Student standard (10, 11 or 12)', String(person.std || 10))
    if (stdInput === null) return
    const divisionInput = window.prompt('Student division (A, B or C)', person.division || 'A')
    if (divisionInput === null) return
    try {
      await api.put(
        `/api/users/${encodeURIComponent(person.id)}/class-placement`,
        { std: Number(stdInput), division: divisionInput.trim().toUpperCase() },
        token,
      )
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to update student class.')
    }
  }

  return (
    <>
      <SectionIntro eyebrow="MANAGEMENT" title={heading} text={descriptions[type] || 'Manage people connected to your tuition centre.'}>
        {canManage && <button type="button" className="primary" onClick={openModal}><UserPlus size={16} />Add {type}</button>}
      </SectionIntro>

      {error && !modalOpen && <div className="profile-message error people-error">{error}</div>}

      <Card title={`${heading} directory`}>
        {loading ? (
          <div className="people-state"><LoaderCircle size={18} className="spin" />Loading {heading.toLowerCase()}...</div>
        ) : visibleData.length ? (
          <div className="attendance-table">
            {visibleData.map(person => (
              <div className="table-row" key={person.id || person.email || person.name}>
                <span className="person">
                  {person.avatarUrl
                    ? <img className="avatar avatar-image" src={person.avatarUrl} alt="" />
                    : <span className="avatar green">{(person.name || '?')[0].toUpperCase()}</span>}
                  <div>
                    <b>{person.name}</b>
                    <small>
                      {(type === 'student' && person.std
                        ? `Class ${person.std} - ${person.division || 'A'}`
                        : '') ||
                        (type === 'teacher' && person.teachingClasses?.length
                          ? person.teachingClasses.join(', ')
                          : '') ||
                        person.className || person.email ||
                        (type === 'teacher' ? 'Faculty' : 'Parent account')}
                    </small>
                  </div>
                </span>
                <div className="people-row-actions">
                  <strong>{person.phone || (person.attendance != null ? `${person.attendance}% attendance` : '')}</strong>
                  {canManage && type === 'student' && (
                    <button type="button" className="secondary people-placement-edit" onClick={() => updatePlacement(person)}>Edit class</button>
                  )}
                  {canManage && type === 'teacher' && (
                    <button type="button" className="secondary people-placement-edit" onClick={() => updateTeacherClasses(person)}>Edit assignments</button>
                  )}
                </div>
                <span className="pill success">Active</span>
                <ChevronRight size={15} />
              </div>
            ))}
          </div>
        ) : (
          <div className="people-state">No {heading.toLowerCase()} found.</div>
        )}
      </Card>

      {modalOpen && (
        <div className="user-modal-backdrop" onMouseDown={closeModal}>
          <div className="user-modal" onMouseDown={event => event.stopPropagation()}>
            <div className="user-modal-head">
              <div>
                <span className="eyebrow">NEW ACCOUNT</span>
                <h3>Add {type}</h3>
                <p>Create login credentials and academic details.</p>
              </div>
              <button type="button" className="modal-close" onClick={closeModal} disabled={saving} aria-label="Close dialog"><X size={18} /></button>
            </div>
            <form onSubmit={submit}>
              <label>Full name
                <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder={type === 'student' ? 'Student name' : type === 'teacher' ? 'Teacher name' : 'Parent name'} required />
              </label>
              <label>Email address
                <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" required />
              </label>
              <label>Temporary password
                <input type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" required />
              </label>
              <label>Phone
                <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Optional" />
              </label>

              {type === 'student' && (
                <div className="people-form-grid">
                  <label>Class / STD
                    <select value={form.std} onChange={event => setForm({ ...form, std: event.target.value })} required>
                      <option value="">Choose class</option>
                      {[10, 11, 12].map(std => <option key={std} value={std}>Class {std}</option>)}
                    </select>
                  </label>
                  <label>Division
                    <select value={form.division} onChange={event => setForm({ ...form, division: event.target.value })} required>
                      {['A', 'B', 'C'].map(division => <option key={division} value={division}>Division {division}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {type === 'teacher' && (
                <fieldset className="teacher-assignment-field">
                  <legend>Assign teaching classes</legend>
                  <p>Select every class this teacher will teach.</p>
                  <div className="teacher-assignment-options">
                    {teacherClassOptions.map(option => (
                      <label key={option.value}>
                        <input type="checkbox" checked={form.teachingClasses.includes(option.value)} onChange={() => toggleClass(option.value)} />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  {!form.teachingClasses.length && <small>Choose at least one class.</small>}
                </fieldset>
              )}

              {error && <div className="login-error user-modal-error">{error}</div>}
              <div className="user-modal-actions">
                <button type="button" className="secondary" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="primary" disabled={saving || (type === 'teacher' && !form.teachingClasses.length)}>
                  {saving && <LoaderCircle size={15} className="spin" />}
                  {saving ? 'Creating...' : `Create ${type}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
