import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, Info, LoaderCircle, Plus, Trash2, ListChecks } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createWeeklyTimetableTemplateApi } from '../api/timetable.api'

const todayIndia=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));return value.year+'-'+value.month+'-'+value.day}
const days=[{value:1,label:'Monday',tone:'green'},{value:2,label:'Tuesday',tone:'blue'},{value:3,label:'Wednesday',tone:'yellow'},{value:4,label:'Thursday',tone:'rose'},{value:5,label:'Friday',tone:'purple'},{value:6,label:'Saturday',tone:'cyan'},{value:0,label:'Sunday',tone:'slate'}]
const blankSlot=dayOfWeek=>({id:dayOfWeek+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),dayOfWeek,startTime:'09:00',endTime:'10:00',subject:'',classNumber:'',division:'',room:'',teacherName:'',notes:''})

export default function WeeklyTimetablePage(){
  const {role}=useOutletContext()
  const {token,user}=useAuth()
  const navigate=useNavigate()
  const principal=role==='principal'||user?.role==='principal'
  const [startDate,setStartDate]=useState(todayIndia)
  const [slots,setSlots]=useState([])
  const [collapsedSlots,setCollapsedSlots]=useState(()=>new Set())
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const endDate=useMemo(()=>{if(!startDate)return '';const date=new Date(startDate+'T12:00:00');date.setDate(date.getDate()+52*7-1);return date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})},[startDate])
  useEffect(()=>{if(!principal)navigate('/'+(user?.role||'')+'/timetable',{replace:true})},[principal,navigate,user?.role])
  const addSlot=dayOfWeek=>{const slot=blankSlot(dayOfWeek);setSlots(current=>[...current,slot]);setCollapsedSlots(current=>new Set([...current].filter(id=>id!==slot.id)));setError('');setSuccess('')}
  const toggleSlot=slotId=>setCollapsedSlots(current=>{const next=new Set(current);if(next.has(slotId))next.delete(slotId);else next.add(slotId);return next})
  const updateSlot=(index,field,value)=>setSlots(current=>current.map((slot,i)=>i===index?{...slot,[field]:value}:slot))
  const removeSlot=index=>{const removed=slots[index];setSlots(current=>current.filter((_,i)=>i!==index));if(removed)setCollapsedSlots(current=>{const next=new Set(current);next.delete(removed.id);return next})}
  const save=async event=>{event.preventDefault();setError('');setSuccess('');if(!slots.length){setError('Add at least one lecture before applying the timetable.');return}const invalid=slots.findIndex(slot=>!slot.subject.trim()||!slot.classNumber.trim()||!slot.startTime||!slot.endTime||slot.startTime>=slot.endTime);if(invalid!==-1){setError('Complete the subject, class and valid start/end times for every lecture.');return}setSaving(true);try{const entries=slots.map(({id,classNumber,division,...slot})=>({...slot,className:(/^class\s*/i.test(classNumber.trim())?classNumber.trim():'Class '+classNumber.trim())+(division.trim()?' - Division '+division.trim():''),teacherName:slot.teacherName.trim()}));const result=await createWeeklyTimetableTemplateApi(token,{startDate,weeks:52,entries});setSuccess(result.message||'Weekly timetable applied for 52 weeks.');window.scrollTo({top:0,behavior:'smooth'})}catch(e){setError(e.message||'Unable to apply the weekly timetable.')}finally{setSaving(false)}}
  if(!principal)return null
  return <main className="weekly-board-page">
    <div className="weekly-board-breadcrumb"><button type="button" onClick={()=>navigate('/principal/overview')}>Home</button><ChevronRight size={13}/><button type="button" onClick={()=>navigate('/principal/timetable')}>Timetable</button><ChevronRight size={13}/><strong>Weekly Timetable</strong><span className="weekly-board-user"><Bell size={17}/><span className="weekly-user-avatar">P</span> Principal</span></div>
    <header className="weekly-board-title"><span className="weekly-board-title-icon"><CalendarDays size={30}/></span><div><h1>Weekly Timetable</h1><p>Create a weekly timetable and apply it for 52 weeks from the selected start date.</p></div></header>
    {error&&<div className="weekly-board-alert error">{error}</div>}
    {success&&<div className="weekly-board-alert success"><CheckCircle2 size={17}/><span>{success}</span><button type="button" onClick={()=>navigate('/principal/timetable')}>View timetable</button></div>}
    <form onSubmit={save} className="weekly-board-form">
      <div className="weekly-board-config-row">
        <section className="weekly-config-card"><h2>Schedule Configuration</h2><div className="weekly-config-content"><label>Start Date <i>*</i><input type="date" name="weeklyStartDate" value={startDate} onChange={e=>setStartDate(e.target.value)} required/></label><div className="weekly-date-summary"><CalendarDays size={28}/><div><span>This timetable will be applied for</span><strong>52 weeks (1 Year)</strong><small>{startDate?new Date(startDate+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'Select start date'} – {endDate}</small></div></div></div></section>
        <aside className="weekly-info-card"><div className="weekly-info-icon"><Info size={17}/></div><div><h3>Important Notes</h3><ul><li>This will create a repeating weekly timetable for 52 weeks.</li><li>Existing timetable entries will not be deleted.</li><li>You can edit or remove individual lectures later from the main timetable.</li><li>Make sure start time is earlier than end time.</li></ul></div></aside>
      </div>
      <div className="weekly-board-days">{days.map(day=>{const daySlots=slots.map((slot,index)=>({...slot,index})).filter(slot=>slot.dayOfWeek===day.value);return <section className={'weekly-board-day tone-'+day.tone} key={day.value}>
        <header className="weekly-board-day-head"><strong>{day.label}</strong><span>(Weekly)</span></header>
        <div className="weekly-board-day-body">{daySlots.length?daySlots.map((slot,position)=>{const isCollapsed=collapsedSlots.has(slot.id);return <article className={'weekly-board-lecture'+(isCollapsed?' is-collapsed':'')} key={slot.id}>
          <div className="weekly-board-lecture-head"><button type="button" className="weekly-board-lecture-toggle" onClick={()=>toggleSlot(slot.id)} aria-expanded={!isCollapsed} aria-label={(isCollapsed?'Expand':'Collapse')+' '+day.label+' lecture '+(position+1)}>{isCollapsed?<ChevronRight size={14}/>:<ChevronDown size={14}/>}<span><strong>Lecture {position+1}</strong>{isCollapsed&&<small>{slot.subject||'Subject not selected'} · {slot.classNumber?((/^class\s*/i.test(slot.classNumber)?slot.classNumber.trim():'Class '+slot.classNumber.trim())+(slot.division?' - '+slot.division:'')).trim():'Class not entered'} · {slot.startTime}–{slot.endTime}</small>}</span></button><button type="button" className="weekly-board-lecture-delete" onClick={()=>removeSlot(slot.index)} aria-label={'Remove '+day.label+' lecture '+(position+1)}><Trash2 size={14}/></button></div>
          {!isCollapsed&&<div className="weekly-board-fields">
            <label>Subject <i>*</i><input name={'subject-'+slot.index} value={slot.subject} onChange={e=>updateSlot(slot.index,'subject',e.target.value)} placeholder="e.g. Mathematics" autoComplete="off" required/></label>
            <label>Class <i>*</i><input name={'class-'+slot.index} value={slot.classNumber} onChange={e=>updateSlot(slot.index,'classNumber',e.target.value)} placeholder="e.g. Class 10" autoComplete="off" required/></label>
            <label>Division (optional)<input name={'division-'+slot.index} value={slot.division} onChange={e=>updateSlot(slot.index,'division',e.target.value)} placeholder="e.g. A" autoComplete="off"/></label>
            <label>Start Time <i>*</i><span className="weekly-time-input"><input name={'start-'+slot.index} type="time" value={slot.startTime} onChange={e=>updateSlot(slot.index,'startTime',e.target.value)} required/><Clock3 size={12}/></span></label>
            <label>End Time <i>*</i><span className="weekly-time-input"><input name={'end-'+slot.index} type="time" value={slot.endTime} onChange={e=>updateSlot(slot.index,'endTime',e.target.value)} required/><Clock3 size={12}/></span></label>
            <label>Teacher (optional)<input name={'teacher-'+slot.index} value={slot.teacherName} onChange={e=>updateSlot(slot.index,'teacherName',e.target.value)} placeholder="Enter teacher name" autoComplete="off"/></label>
            <label>Room No.<input name={'room-'+slot.index} value={slot.room} onChange={e=>updateSlot(slot.index,'room',e.target.value)} placeholder="e.g. Room 101"/></label>
            <label className="weekly-board-notes">Notes<input name={'notes-'+slot.index} value={slot.notes} onChange={e=>updateSlot(slot.index,'notes',e.target.value)} placeholder="Optional lecture notes"/></label>
          </div>}
        </article>}) :<div className="weekly-board-empty"><CalendarDays size={28}/><strong>No lectures added</strong><span>Click the button below to add lectures for {day.label}.</span></div>}</div>
        <button type="button" className="weekly-board-add" onClick={()=>addSlot(day.value)}><Plus size={15}/> Add Lecture</button>
      </section>})}</div>
      <footer className="weekly-board-footer"><div className="weekly-board-summary-icon"><ListChecks size={22}/></div><div className="weekly-board-summary-text"><strong>Summary</strong><span>Review your weekly schedule before applying.</span><small>{slots.length} lectures · 52 weeks</small></div><button type="button" className="secondary" onClick={()=>navigate('/principal/timetable')}>Cancel</button><button type="submit" className="primary weekly-board-apply" disabled={saving||slots.length===0}>{saving?<LoaderCircle size={16} className="spin"/>:<CalendarDays size={16}/>} {saving?'Applying...':'Apply Weekly Timetable'}</button></footer>
    </form>
  </main>
}
