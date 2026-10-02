import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CreditCard, Edit3, IndianRupee, LoaderCircle, Plus, ReceiptText, Users, X } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, Stat } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { listStudentFeesApi, saveStudentFeeApi } from '../api/fees.api'

const ACADEMIC_YEAR = '2026-27'
const methods = { cash: 'Cash', upi: 'UPI', bank: 'Bank transfer', card: 'Card', other: 'Other' }
const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`
const dateValue = value => value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
const newInstallment = () => ({ amount: '', paidOn: dateValue(), method: 'cash', reference: '', note: '' })

export default function FeesPage() {
  const { role, search } = useOutletContext()
  const { token } = useAuth()
  const principal = role === 'principal'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(principal)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ totalFee: '', academicYear: ACADEMIC_YEAR, notes: '', installments: [] })

  const load = async () => {
    if (!principal) return
    setLoading(true); setError('')
    try { const result = await listStudentFeesApi(token, ACADEMIC_YEAR); setRecords(result.fees || []) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [token, principal])

  const visible = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    return records.filter(r => `${r.student.name} ${r.student.className || ''} ${r.status}`.toLowerCase().includes(q))
  }, [records, search])

  const totals = useMemo(() => ({
    total: records.reduce((n, r) => n + Number(r.totalFee || 0), 0),
    paid: records.reduce((n, r) => n + Number(r.paidAmount || 0), 0),
    pending: records.reduce((n, r) => n + Number(r.pendingAmount || 0), 0),
    paidStudents: records.filter(r => r.status === 'Paid').length,
  }), [records])

  const openEditor = record => {
    setError(''); setSelected(record)
    setForm({
      totalFee: record.totalFee || '',
      academicYear: record.academicYear || ACADEMIC_YEAR,
      notes: record.notes || '',
      installments: (record.installments || []).map(i => ({ amount: i.amount, paidOn: dateValue(i.paidOn), method: i.method || 'cash', reference: i.reference || '', note: i.note || '' })),
    })
  }

  const paid = form.installments.reduce((n, i) => n + Number(i.amount || 0), 0)
  const balance = Math.max(Number(form.totalFee || 0) - paid, 0)
  const updateInstallment = (index, field, value) => setForm(f => ({ ...f, installments: f.installments.map((i, n) => n === index ? { ...i, [field]: value } : i) }))

  const save = async e => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await saveStudentFeeApi(token, selected.student.id, {
        academicYear: form.academicYear,
        totalFee: Number(form.totalFee),
        installments: form.installments.map(i => ({ ...i, amount: Number(i.amount) })),
        notes: form.notes,
      })
      setSelected(null); await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  if (!principal) return <Card title="Fee details"><div className="fee-state">Fee information for your account will appear here.</div></Card>

  return <>
    <div className="fee-summary-grid">
      <Stat icon={CreditCard} label="Total fees" value={money(totals.total)} detail="Current academic year" />
      <Stat icon={CheckCircle2} label="Collected" value={money(totals.paid)} detail={`${totals.paidStudents} students fully paid`} />
      <Stat icon={IndianRupee} label="Pending" value={money(totals.pending)} detail="Amount still due" />
      <Stat icon={Users} label="Students" value={String(records.length)} detail="Fee records" />
    </div>

    {error && !selected && <div className="profile-message error fees-error">{error}</div>}
    <Card title="Student fee records">
      {loading ? <div className="fee-state"><LoaderCircle size={18} className="spin" />Loading student fee records...</div> :
       visible.length ? <div className="fee-table">
        <div className="fee-table-row fee-table-head"><span>Student</span><span>Total</span><span>Paid</span><span>Installments</span><span>Balance</span><span>Status</span><span /></div>
        {visible.map(r => <div className="fee-table-row" key={r.student.id}>
          <span className="fee-student">{r.student.avatarUrl ? <img src={r.student.avatarUrl} className="avatar avatar-image" alt="" /> : <span className="avatar green">{r.student.name[0]}</span>}<span><b>{r.student.name}</b><small>{r.student.className || r.student.email || 'Student'}</small></span></span>
          <strong>{money(r.totalFee)}</strong><strong>{money(r.paidAmount)}</strong><span>{r.installmentCount}</span>
          <strong className={r.pendingAmount ? 'fee-balance' : 'fee-paid'}>{money(r.pendingAmount)}</strong>
          <span className={`pill ${r.status === 'Paid' ? 'success' : r.status === 'Partially paid' ? 'warning' : 'danger'}`}>{r.status}</span>
          <button className="fee-edit-button" onClick={() => openEditor(r)}><Edit3 size={14} />Edit</button>
        </div>)}
       </div> : <div className="fee-state">No students found.</div>}
    </Card>

    {selected && <div className="fee-modal-backdrop" onMouseDown={() => !saving && setSelected(null)}>
      <div className="fee-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="fee-modal-head"><div><span className="eyebrow">PAYMENT RECORD</span><h3>{selected.student.name}</h3><p>Enter the annual fee and record each payment installment.</p></div><button className="modal-close" onClick={() => !saving && setSelected(null)}><X size={18} /></button></div>
        <form className="fee-form" onSubmit={save}>
          <div className="fee-form-summary"><div><span>Total fee</span><strong>{money(form.totalFee)}</strong></div><div><span>Paid</span><strong>{money(paid)}</strong></div><div><span>Balance</span><strong>{money(balance)}</strong></div><div><span>Installments</span><strong>{form.installments.length}</strong></div></div>
          <div className="fee-form-grid"><label>Total annual fee<input type="number" min="0" value={form.totalFee} onChange={e => setForm({ ...form, totalFee: e.target.value })} required /></label><label>Academic year<input value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })} required /></label></div>
          <div className="fee-installment-head"><div><strong>Payment installments</strong><span>Each payment is saved separately with date and method.</span></div><button type="button" className="secondary" onClick={() => setForm(f => ({ ...f, installments: [...f.installments, newInstallment()] }))}><Plus size={14} />Add installment</button></div>
          {form.installments.map((item, index) => <div className="fee-installment" key={index}><div className="fee-installment-number">{index + 1}</div><div className="fee-installment-fields">
            <label>Amount<input type="number" min="1" value={item.amount} onChange={e => updateInstallment(index, 'amount', e.target.value)} required /></label>
            <label>Paid on<input type="date" value={item.paidOn} onChange={e => updateInstallment(index, 'paidOn', e.target.value)} required /></label>
            <label>Method<select value={item.method} onChange={e => updateInstallment(index, 'method', e.target.value)}>{Object.entries(methods).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Reference<input value={item.reference} onChange={e => updateInstallment(index, 'reference', e.target.value)} placeholder="Optional transaction ID" /></label>
            <label className="fee-wide-field">Note<input value={item.note} onChange={e => updateInstallment(index, 'note', e.target.value)} placeholder="Optional" /></label>
          </div><button type="button" className="fee-delete-installment" onClick={() => setForm(f => ({ ...f, installments: f.installments.filter((_, n) => n !== index) }))}><ReceiptText size={14} /></button></div>)}
          {!form.installments.length && <div className="fee-no-installments"><ReceiptText size={18} />No payment recorded yet.</div>}
          <label>Notes<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Concession, scholarship, agreement or other fee note..." /></label>
          {error && <div className="profile-message error">{error}</div>}
          <div className="fee-modal-actions"><button type="button" className="secondary" onClick={() => !saving && setSelected(null)}>Cancel</button><button className="primary" disabled={saving}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? 'Saving...' : 'Save payment record'}</button></div>
        </form>
      </div>
    </div>}
  </>
}
