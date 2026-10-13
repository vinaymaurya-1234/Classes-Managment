import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, LoaderCircle, UserPlus, X, BookOpen, Trophy, Wallet, Users } from 'lucide-react'
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
  division: '',
  teachingClasses: [],
  childIds: [],
})
const teacherClassOptions = [11, 12].flatMap(std => [
  { value: `Class ${std}`, label: `Class ${std} · Any division` },
  ...['A', 'B', 'C'].map(division => ({ value: `Class ${std} - ${division}`, label: `Class ${std} · Division ${division}` })),
])

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
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [selectedAttempt, setSelectedAttempt] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feeRecords, setFeeRecords] = useState([])
  const [availableStudents, setAvailableStudents] = useState([])

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

  const openPerson = async person => {
    setSelectedPerson(person); setSelectedAttempt(null); setAttempts([]); setFeeRecords([]); setError('');
    if (!canManage || !token) return;
    setDetailLoading(true);
    try {
      if (type === 'student') {
        const [result, fees] = await Promise.all([
          api.get(`/api/exams/students/${encodeURIComponent(person.id)}/attempts`, token),
          api.get('/api/fees/students', token).catch(() => ({ fees: [] })),
        ]);
        setAttempts(result.data || []);
        setFeeRecords((fees.fees || []).filter(item => item.student?.id === person.id));
      } else if (type === 'parent') {
        const fees = await api.get('/api/fees/students', token).catch(() => ({ fees: [] }));
        const linkedIds = (person.children || []).map(child => child.id);
        setFeeRecords((fees.fees || []).filter(fee => linkedIds.includes(fee.student?.id)));
      }
    } catch (err) { setError(err.message || 'Unable to load account details.') }
    finally { setDetailLoading(false) }
  }

  const openModal = async () => {
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
    if (type === 'parent' && token && !availableStudents.length) {
      try { const result = await listUsersApi(token, 'student'); setAvailableStudents(result.users || []) }
      catch (err) { setError(err.message || 'Unable to load students for parent linking.') }
    }
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
        ...(type === 'parent' ? { childIds: form.childIds } : {}),
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

      {selectedPerson ? <Card title={`${selectedPerson.name} · ${type} details`}><div className="person-detail-page"><button type="button" className="secondary" onClick={()=>{setSelectedPerson(null);setSelectedAttempt(null);setError('')}}><ArrowLeft size={15}/> Back to {heading.toLowerCase()}</button><div className="person-detail-hero">{selectedPerson.avatarUrl?<img className="avatar avatar-image" src={selectedPerson.avatarUrl} alt=""/>:<span className="avatar green">{(selectedPerson.name||'?')[0].toUpperCase()}</span>}<div><h2>{selectedPerson.name}</h2><p>{selectedPerson.email}</p><span>{selectedPerson.phone||'No phone provided'}</span></div></div>{detailLoading?<div className="people-state"><LoaderCircle size={18} className="spin"/>Loading details...</div>:<><div className="person-detail-actions">{type==='student'&&<button type="button" className="secondary" onClick={()=>updatePlacement(selectedPerson)}>Edit class and division</button>}{type==='teacher'&&<button type="button" className="secondary" onClick={()=>updateTeacherClasses(selectedPerson)}>Edit teaching assignments</button>}</div><div className="person-detail-grid"><div><span>Email</span><strong>{selectedPerson.email||'—'}</strong></div><div><span>Phone</span><strong>{selectedPerson.phone||'—'}</strong></div>{type==='student'&&<><div><span>Class</span><strong>Class {selectedPerson.std||'—'}{selectedPerson.division?` · Division ${selectedPerson.division}`:''}</strong></div><div><span>Account created</span><strong>{selectedPerson.createdAt?new Date(selectedPerson.createdAt).toLocaleDateString('en-IN'):'—'}</strong></div></>}{type==='teacher'&&<div className="person-detail-wide"><span>Assigned classes</span><strong>{(selectedPerson.teachingClasses||[]).join(', ')||'No classes assigned'}</strong></div>}</div>{canManage&&type==='student'&&<div className="person-detail-section"><div className="person-detail-section-head"><h3><Trophy size={16}/> Recent attempted tests</h3><span>{attempts.length} attempts</span></div>{attempts.length?attempts.map(attempt=><article className="person-test-card" key={attempt.id}><button type="button" className="person-test-summary" onClick={()=>setSelectedAttempt(selectedAttempt?.id===attempt.id?null:attempt)}><span><strong>{attempt.exam?.title||'Exam'}</strong><small>{attempt.exam?.subject||'Subject'} · {attempt.submittedAt?new Date(attempt.submittedAt).toLocaleDateString('en-IN'):'Submitted'}</small></span><span className="person-test-score">{attempt.score??0} / {attempt.totalMarks}</span><ChevronRight size={16}/></button>{selectedAttempt?.id===attempt.id&&<div className="person-question-review">{(attempt.questions||[]).map((question,index)=><div className="person-question" key={question.id}><div className="person-question-title"><strong>Q{index+1}. {question.text}</strong><span className={'pill '+(question.status==='correct'?'success':question.status==='incorrect'?'danger':'neutral')}>{question.status}</span></div><p>Your answer: <b>{question.selectedAnswer||'Skipped'}</b></p>{question.correctAnswer&&<p>Correct answer: <b>{question.correctAnswer}</b></p>}{question.explanation&&<small>{question.explanation}</small>}</div>)}</div>}</article>):<p className="person-detail-empty">No submitted test attempts found for this student.</p>}</div>}{type==='student'&&<div className="person-detail-section"><div className="person-detail-section-head"><h3><Wallet size={16}/> Fee details</h3></div>{feeRecords.length?feeRecords.map(fee=><div className="person-fee-row" key={fee.id||fee.academicYear}><span>{fee.academicYear}</span><strong>₹{Number(fee.pendingAmount||0).toLocaleString('en-IN')} pending</strong><small>₹{Number(fee.paidAmount||0).toLocaleString('en-IN')} paid of ₹{Number(fee.totalFee||0).toLocaleString('en-IN')}</small></div>):<p className="person-detail-empty">No fee record is available yet.</p>}</div>}{type==='parent'&&<div className="person-detail-section"><div className="person-detail-section-head"><h3><Users size={16}/> Linked children and fee overview</h3><span>{(selectedPerson.children||[]).length} children</span></div>{(selectedPerson.children||[]).map(child=><div className="person-fee-row" key={child.id}><span>{child.name} · Class {child.std||'—'}{child.division?' · Division '+child.division:''}</span><small>{child.email}</small></div>)}{feeRecords.length?feeRecords.map(fee=><div className="person-fee-row" key={fee.id||fee.student?.id}><span>{fee.student?.name} · {fee.student?.className||'Class not assigned'}</span><strong>₹{Number(fee.pendingAmount||0).toLocaleString('en-IN')} pending</strong><small>{fee.installmentCount||0} recorded installments</small></div>):<p className="person-detail-empty">No student fee records found.</p>}</div>}{type==='teacher'&&<div className="person-detail-section"><div className="person-detail-section-head"><h3><BookOpen size={16}/> Teaching overview</h3></div><p className="person-detail-empty">The assigned classes are listed above. Class-level chapter progress and rosters are available in the teacher's My Classes area.</p></div>}</>}</div></Card> : <Card title={`${heading} directory`}>
        {loading ? (
          <div className="people-state"><LoaderCircle size={18} className="spin" />Loading {heading.toLowerCase()}...</div>
        ) : visibleData.length ? (
          <div className="attendance-table">
            {visibleData.map(person => (
              <div className="table-row people-clickable-row" key={person.id || person.email || person.name} onClick={()=>openPerson(person)} role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openPerson(person)}}}>
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
                    <button type="button" className="secondary people-placement-edit" onClick={event => {event.stopPropagation();openPerson(person)}}>Edit class</button>
                  )}
                  {canManage && type === 'teacher' && (
                    <button type="button" className="secondary people-placement-edit" onClick={event => {event.stopPropagation();openPerson(person)}}>Edit assignments</button>
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
      </Card>}

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
                      <option value="">No division selected</option>{['A', 'B', 'C'].map(division => <option key={division} value={division}>Division {division}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {type === 'parent' && (
                <fieldset className="teacher-assignment-field">
                  <legend>Link children (optional)</legend>
                  <p>Select the students linked to this parent account.</p>
                  <div className="teacher-assignment-options">
                    {availableStudents.map(student => <label key={student.id}>
                      <input type="checkbox" checked={form.childIds.includes(student.id)} onChange={() => setForm(current => ({...current, childIds: current.childIds.includes(student.id) ? current.childIds.filter(id => id !== student.id) : [...current.childIds, student.id]}))} />
                      {student.name} · Class {student.std || '—'}{student.division ? ' - ' + student.division : ''}
                    </label>)}
                    {!availableStudents.length && <small>No student accounts loaded yet.</small>}
                  </div>
                </fieldset>
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
                  {!form.teachingClasses.length && <small>Choose a class, with or without a division.</small>}
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
