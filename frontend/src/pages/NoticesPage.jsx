import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCircle2, LoaderCircle, MessageSquare, Send, Users, X } from 'lucide-react'
import { SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { listUsersApi } from '../api/users.api'
import { createNoticeApi, listNoticesApi } from '../api/notices.api'

const audienceOptions = [
  { value: 'all', label: 'Everyone', description: 'All teachers, students and parents' },
  { value: 'role', label: 'A group', description: 'Send to every user in one role' },
  { value: 'users', label: 'Specific users', description: 'Choose one or more people' },
]
const roleLabels = { teacher: 'Teachers', student: 'Students', parent: 'Parents' }
const formatDate = value => new Intl.DateTimeFormat('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value))

export default function NoticesPage() {
  const { token, user } = useAuth()
  const isPrincipal = user?.role === 'principal'
  const [notices,setNotices]=useState([]),[users,setUsers]=useState([]),[loading,setLoading]=useState(true),[loadingUsers,setLoadingUsers]=useState(false),[saving,setSaving]=useState(false),[open,setOpen]=useState(false),[error,setError]=useState('')
  const [form,setForm]=useState({title:'',message:'',audienceType:'all',audienceRole:'student',recipientIds:[]})
  const loadNotices = async () => { setLoading(true); setError(''); try { const result=await listNoticesApi(token); setNotices(result.notices||[]) } catch(err) { setError(err.message||'Unable to load notices.') } finally { setLoading(false) } }
  useEffect(()=>{ if(token) loadNotices() },[token])
  const loadRecipients = async () => { setLoadingUsers(true); setError(''); try { const result=await listUsersApi(token); setUsers(result.users||[]) } catch(err) { setError(err.message||'Unable to load users.') } finally { setLoadingUsers(false) } }
  const openComposer = () => { setForm({title:'',message:'',audienceType:'all',audienceRole:'student',recipientIds:[]}); setError(''); setOpen(true); if(!users.length) loadRecipients() }
  const closeComposer = () => { if(!saving) setOpen(false) }
  const setAudience = audienceType => setForm(current=>({...current,audienceType,recipientIds:audienceType==='users'?current.recipientIds:[]}))
  const toggleRecipient = id => setForm(current=>({...current,recipientIds:current.recipientIds.includes(id)?current.recipientIds.filter(item=>item!==id):[...current.recipientIds,id]}))
  const groupedUsers = useMemo(()=>({teacher:users.filter(person=>person.role==='teacher'),student:users.filter(person=>person.role==='student'),parent:users.filter(person=>person.role==='parent')}),[users])
  const submit = async event => { event.preventDefault(); setSaving(true); setError(''); try { await createNoticeApi(token,form); setOpen(false); await loadNotices() } catch(err) { setError(err.message||'Unable to send notice.') } finally { setSaving(false) } }
  const audienceText = notice => { if(notice.audienceType==='all') return 'EVERYONE'; if(notice.audienceType==='role') return roleLabels[notice.audienceRole]||'GROUP'; const count=notice.recipientIds?.length||0; return count+' SPECIFIC USER'+(count===1?'':'S') }
  return <>
    <SectionIntro eyebrow="COMMUNICATION" title="Notices" text={isPrincipal?'Send updates to everyone, a role, or selected users.':'Important messages from your tuition centre.'}>{isPrincipal&&<button className="primary" onClick={openComposer}><MessageSquare size={16}/>New notice</button>}</SectionIntro>
    {error&&!open&&<div className="profile-message error people-error">{error}</div>}
    {loading?<div className="notice-state"><LoaderCircle size={18} className="spin"/>Loading notices...</div>:notices.length?<div className="notice-list">{notices.map(notice=><article className="notice-card notice-card-live" key={notice.id}><div className="notice-icon"><Bell size={19}/></div><div className="notice-content"><div className="notice-meta"><span>{audienceText(notice)}</span><time>{formatDate(notice.createdAt)}</time></div><h3>{notice.title}</h3><p>{notice.message}</p>{isPrincipal&&notice.createdBy?.name&&<small className="notice-sender">Sent by {notice.createdBy.name}</small>}</div></article>)}</div>:<div className="notice-empty"><div className="notice-empty-icon"><MessageSquare size={22}/></div><h3>No notices yet</h3><p>{isPrincipal?'Create your first notice to keep everyone updated.':'There are no notices addressed to you yet.'}</p>{isPrincipal&&<button className="secondary" onClick={openComposer}><Send size={14}/>Create notice</button>}</div>}
    {open&&isPrincipal&&<div className="notice-modal-backdrop" onMouseDown={closeComposer}><section className="notice-modal" onMouseDown={event=>event.stopPropagation()}>
      <div className="notice-modal-head"><div><span className="eyebrow">COMMUNICATION</span><h3>Send a notice</h3><p>Choose exactly who should receive this message.</p></div><button type="button" className="modal-close" onClick={closeComposer} disabled={saving}><X size={18}/></button></div>
      <form onSubmit={submit}>
        <label className="notice-form-label">Title<input value={form.title} maxLength={160} onChange={event=>setForm({...form,title:event.target.value})} placeholder="e.g. Test on Saturday" required/></label>
        <label className="notice-form-label">Message<textarea value={form.message} maxLength={5000} onChange={event=>setForm({...form,message:event.target.value})} placeholder="Write the notice..." rows={5} required/></label>
        <div className="notice-form-label">Send to</div><div className="notice-audience-grid">{audienceOptions.map(option=><button type="button" key={option.value} className={'notice-audience-option '+(form.audienceType===option.value?'active':'')} onClick={()=>setAudience(option.value)}><span>{option.value==='all'?<Users size={16}/>:option.value==='role'?<Bell size={16}/>:<CheckCircle2 size={16}/>}</span><strong>{option.label}</strong><small>{option.description}</small></button>)}</div>
        {form.audienceType==='role'&&<div className="notice-role-picker">{Object.entries(roleLabels).map(([role,label])=><button type="button" key={role} className={'notice-role-button '+(form.audienceRole===role?'active':'')} onClick={()=>setForm({...form,audienceRole:role})}>{label}</button>)}</div>}
        {form.audienceType==='users'&&<div className="notice-user-picker"><div className="notice-picker-head"><strong>Select recipients</strong><span>{form.recipientIds.length} selected</span></div>{loadingUsers?<div className="notice-picker-state"><LoaderCircle size={15} className="spin"/>Loading users...</div>:users.length?<div className="notice-user-groups">{Object.entries(groupedUsers).map(([role,people])=>people.length?<div className="notice-user-group" key={role}><span className="notice-user-group-title">{roleLabels[role]}</span>{people.map(person=><label className={'notice-user-option '+(form.recipientIds.includes(person.id)?'selected':'')} key={person.id}><input type="checkbox" checked={form.recipientIds.includes(person.id)} onChange={()=>toggleRecipient(person.id)}/><span className="notice-user-avatar">{person.name?.charAt(0).toUpperCase()||'U'}</span><span className="notice-user-details"><strong>{person.name}</strong><small>{person.email}</small></span></label>)}</div>:null)}</div>:<div className="notice-picker-state">No teachers, students or parents have been added yet.</div>}</div>}
        {error&&<div className="login-error user-modal-error">{error}</div>}<div className="user-modal-actions"><button type="button" className="secondary" onClick={closeComposer} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving?<LoaderCircle size={15} className="spin"/>:<Send size={15}/>} {saving?'Sending...':'Send notice'}</button></div>
      </form></section></div>}
  </>
}