import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, CalendarRange, CheckCircle2, Clock3, Copy, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createWeeklyTimetableTemplateApi, getTimetableTeachersApi } from '../api/timetable.api'

const todayIndia=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));return value.year+'-'+value.month+'-'+value.day}
const days=[{value:1,label:'Monday'},{value:2,label:'Tuesday'},{value:3,label:'Wednesday'},{value:4,label:'Thursday'},{value:5,label:'Friday'},{value:6,label:'Saturday'},{value:0,label:'Sunday'}]
const blankSlot=dayOfWeek=>({dayOfWeek,startTime:'08:00',endTime:'09:00',subject:'',className:'',room:'',teacherId:'',notes:''})

export default function WeeklyTimetablePage(){
  const {role}=useOutletContext()
  const {token,user}=useAuth()
  const navigate=useNavigate()
  const principal=role==='principal'||user?.role==='principal'
  const [startDate,setStartDate]=useState(todayIndia)
  const [slots,setSlots]=useState([])
  const [teachers,setTeachers]=useState([])
  const [loadingTeachers,setLoadingTeachers]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  useEffect(()=>{if(!principal){navigate('/'+(user?.role||'')+'/timetable',{replace:true});return}let active=true;getTimetableTeachersApi(token).then(r=>{if(active)setTeachers(r.teachers||[])}).catch(e=>{if(active)setError(e.message||'Unable to load teachers.')}).finally(()=>{if(active)setLoadingTeachers(false)});return()=>{active=false}},[principal,token,navigate,user?.role])
  const addSlot=dayOfWeek=>{setSlots(current=>[...current,blankSlot(dayOfWeek)]);setError('');setSuccess('')}
  const updateSlot=(index,field,value)=>setSlots(current=>current.map((slot,i)=>i===index?{...slot,[field]:value}:slot))
  const removeSlot=index=>setSlots(current=>current.filter((_,i)=>i!==index))
  const save=async event=>{event.preventDefault();setError('');setSuccess('');if(!slots.length){setError('Add at least one lecture before applying the timetable.');return}const invalid=slots.findIndex(slot=>!slot.subject.trim()||!slot.className.trim()||!slot.startTime||!slot.endTime||slot.startTime>=slot.endTime);if(invalid!==-1){setError('Complete the subject, class and valid start/end times for every lecture.');return}setSaving(true);try{const result=await createWeeklyTimetableTemplateApi(token,{startDate,weeks:52,entries:slots});setSuccess(result.message||'Weekly timetable applied for 52 weeks.');window.scrollTo({top:0,behavior:'smooth'})}catch(e){setError(e.message||'Unable to apply the weekly timetable.')}finally{setSaving(false)}}
  if(!principal)return null
  return <main className="weekly-builder-page">
    <div className="weekly-builder-topbar"><button type="button" className="secondary weekly-back-button" onClick={()=>navigate('/principal/timetable')}><ArrowLeft size={16}/> Back to timetable</button><span className="weekly-builder-kicker"><CalendarRange size={15}/> PRINCIPAL · TIMETABLE PLANNER</span></div>
    <header className="weekly-builder-hero"><div><span className="eyebrow">REPEATING WEEKLY SCHEDULE</span><h1>Build your weekly timetable</h1><p>Add as many lectures as needed to each day. This weekly pattern will be applied for 52 weeks, and individual dates can still be edited from the main timetable.</p></div><div className="weekly-builder-stat"><CalendarRange size={20}/><strong>52 weeks</strong><span>Year-round schedule</span></div></header>
    {error&&<div className="weekly-builder-alert error">{error}</div>}
    {success&&<div className="weekly-builder-alert success"><CheckCircle2 size={17}/><span>{success}</span><button type="button" onClick={()=>navigate('/principal/timetable')}>View timetable</button></div>}
    <form onSubmit={save} className="weekly-builder-form">
      <section className="weekly-builder-settings"><div><span className="weekly-field-label">SCHEDULE START DATE</span><p>Choose the first date this weekly pattern should follow.</p></div><label className="weekly-start-date"><CalendarRange size={17}/><input type="date" name="weeklyStartDate" value={startDate} onChange={e=>setStartDate(e.target.value)} required/></label></section>
      <div className="weekly-builder-section-title"><div><span className="eyebrow">YOUR STANDARD WEEK</span><h2>Lectures by day</h2><p>Each day can contain multiple lectures with different classes, teachers and timings.</p></div><span className="weekly-total-count">{slots.length} lecture{slots.length===1?'':'s'} added</span></div>
      {days.map(day=>{const daySlots=slots.map((slot,index)=>({...slot,index})).filter(slot=>slot.dayOfWeek===day.value);return <section className="weekly-builder-day" key={day.value}>
        <div className="weekly-builder-day-header"><div className="weekly-day-name"><span className="weekly-day-number">{daySlots.length}</span><div><h3>{day.label}</h3><p>{daySlots.length?daySlots.length+' lecture'+(daySlots.length===1?'':'s')+' planned':'No lectures added yet'}</p></div></div><button type="button" className="secondary weekly-add-button" onClick={()=>addSlot(day.value)}><Plus size={15}/> Add lecture</button></div>
        {daySlots.length>0&&<div className="weekly-builder-lectures">{daySlots.map(slot=><article className="weekly-builder-lecture" key={slot.index}>
          <div className="weekly-lecture-heading"><span><Clock3 size={14}/><b>Lecture {daySlots.findIndex(item=>item.index===slot.index)+1}</b></span><button type="button" className="weekly-remove-button" onClick={()=>removeSlot(slot.index)} aria-label={'Remove lecture '+(slot.index+1)}><Trash2 size={15}/> Remove</button></div>
          <div className="weekly-builder-fields">
            <label>Subject <input name={'subject-'+slot.index} value={slot.subject} onChange={e=>updateSlot(slot.index,'subject',e.target.value)} placeholder="e.g. Mathematics" required/></label>
            <label>Class / Division <input name={'class-'+slot.index} value={slot.className} onChange={e=>updateSlot(slot.index,'className',e.target.value)} placeholder="e.g. Class 10 - A" required/></label>
            <label>Start time <input name={'start-'+slot.index} type="time" value={slot.startTime} onChange={e=>updateSlot(slot.index,'startTime',e.target.value)} required/></label>
            <label>End time <input name={'end-'+slot.index} type="time" value={slot.endTime} onChange={e=>updateSlot(slot.index,'endTime',e.target.value)} required/></label>
            <label>Teacher <select name={'teacher-'+slot.index} value={slot.teacherId} onChange={e=>updateSlot(slot.index,'teacherId',e.target.value)}><option value="">No teacher assigned</option>{teachers.map(teacher=><option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
            <label>Room <input name={'room-'+slot.index} value={slot.room} onChange={e=>updateSlot(slot.index,'room',e.target.value)} placeholder="e.g. Room 04"/></label>
            <label className="weekly-notes-field">Notes (optional) <input name={'notes-'+slot.index} value={slot.notes} onChange={e=>updateSlot(slot.index,'notes',e.target.value)} placeholder="Extra information for this lecture"/></label>
          </div>
        </article>)}</div>}
        {daySlots.length===0&&<button type="button" className="weekly-empty-add" onClick={()=>addSlot(day.value)}><Plus size={15}/> Add the first lecture for {day.label}</button>}
      </section>})}
      <footer className="weekly-builder-footer"><div><Copy size={17}/><span><strong>Apply this pattern for 52 weeks</strong><small>Existing timetable entries will not be deleted.</small></span></div><button type="submit" className="primary weekly-apply-button" disabled={saving||loadingTeachers||slots.length===0}>{saving?<LoaderCircle size={16} className="spin"/>:<CalendarRange size={16}/>} {saving?'Applying schedule...':'Apply weekly timetable'}</button></footer>
    </form>
    {loadingTeachers&&<p className="weekly-teacher-loading"><LoaderCircle size={14} className="spin"/> Loading teacher list...</p>}
  </main>
}
