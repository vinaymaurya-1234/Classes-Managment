import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getTimetableApi } from '../api/timetable.api'
import { getStudentAttendanceSummaryApi } from '../api/attendance.api'
import { BookOpen, CalendarDays, CheckCircle2, ClipboardList, CreditCard, MessageSquare, PlayCircle, QrCode, Trophy, UserPlus, Users, LoaderCircle } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, Quick, ScheduleRow, Stat, Attention } from '../components/common/UI'
import { todayLectures } from '../data/mockData'
import { api } from '../api/client'
import { listNoticesApi } from '../api/notices.api'

function Principal({go}){
 const {token}=useAuth();const [lectures,setLectures]=useState([]);const [scheduleError,setScheduleError]=useState('');
 useEffect(()=>{if(!token)return;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const dateParts=Object.fromEntries(parts.map(p=>[p.type,p.value]));const today=dateParts.year+'-'+dateParts.month+'-'+dateParts.day;let active=true;getTimetableApi(token,today).then(r=>{if(active)setLectures(r.entries||[])}).catch(e=>{if(active)setScheduleError(e.message||'Unable to load today’s timetable.')});return()=>{active=false}},[token]);
 return <><div className="stats"><Stat icon={Users} label="Total students" value="248" detail="+12 this month"/><Stat icon={BookOpen} label="Active teachers" value="18" detail="16 present today"/><Stat icon={CheckCircle2} label="Today's attendance" value="94.2%" detail="+2.4% vs last week"/><Stat icon={CreditCard} label="Fees collected" value="₹8.42L" detail="₹1.18L pending"/></div><div className="grid-main"><Card title="Today's schedule" action="View timetable" onAction={()=>go('timetable')}><div className="schedule">{scheduleError?<p className="people-state">{scheduleError}</p>:lectures.length?lectures.map(x=><div className="schedule-row" key={x.id}><div className="schedule-time"><strong>{x.startTime}</strong><span>{x.endTime}</span></div><div className="schedule-copy"><strong>{x.subject}</strong><span>{x.className}{x.room?' · '+x.room:''}</span><small>{x.teacher?.name||'Teacher not assigned'}</small></div></div>):<div className="people-state">No lectures scheduled for today. <button className="secondary" onClick={()=>go('timetable')}>Set timetable</button></div>}</div></Card><Card title="Needs attention"><div className="attention"><Attention icon={CreditCard} title="Fee payments" text="23 students have pending fees" tone="amber"/><Attention icon={Users} title="Attendance" text="8 students below 75% attendance" tone="red"/><Attention icon={ClipboardList} title="Homework" text="5 classes have overdue homework" tone="green"/></div></Card></div><div className="quick-grid"><Quick icon={CalendarDays} title="Set timetable" text="Plan daily, weekly or monthly lectures" onClick={()=>go('timetable')}/><Quick icon={UserPlus} title="Add people" text="Create student, teacher or parent records" onClick={()=>go('students')}/><Quick icon={CreditCard} title="Manage fees" text="Track paid and pending fees" onClick={()=>go('fees')}/><Quick icon={MessageSquare} title="Send notice" text="Notify parents and students" onClick={()=>go('notices')}/></div></>
}

function Teacher({go}){return <><div className="stats"><Stat icon={BookOpen} label="Active chapters" value="7" detail="2 in progress today"/><Stat icon={Users} label="My students" value="86" detail="Across 4 classes"/><Stat icon={CheckCircle2} label="My attendance" value="100%" detail="Present this month"/><Stat icon={ClipboardList} label="Homework" value="12" detail="4 awaiting review"/></div><div className="grid-main"><Card title="Today's teaching" action="Full timetable" onAction={()=>go('timetable')}><div className="schedule">{todayLectures.slice(0,3).map(x=><ScheduleRow key={x.time} {...x}/>)}</div></Card><Card title="Chapter in progress"><div className="chapter-focus"><div className="chapter-icon"><PlayCircle size={23}/></div><div><span>PHYSICS · CLASS 12</span><h3>Electrostatics</h3><p>Chapter 4 · 62% completed</p></div><button onClick={()=>go('chapters')}>Continue</button></div></Card></div><div className="quick-grid three"><Quick icon={PlayCircle} title="Start chapter" text="Begin or continue today's chapter" onClick={()=>go('chapters')}/><Quick icon={ClipboardList} title="Give homework" text="Send a note or task to students" onClick={()=>go('homework')}/><Quick icon={CheckCircle2} title="Mark attendance" text="Record your lecture presence" onClick={()=>go('attendance')}/></div></>}

function todayInIndia(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]))
 return values.year+'-'+values.month+'-'+values.day
}
function Student({go}){
 const {token}=useAuth()
 const [lectures,setLectures]=useState([])
 const [homework,setHomework]=useState([])
 const [results,setResults]=useState([])
 const [attendance,setAttendance]=useState(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const today=useMemo(todayInIndia,[])
 useEffect(()=>{
  if(!token)return
  let active=true
  Promise.allSettled([
   getTimetableApi(token,today),
   api.get('/api/homework',token),
   api.get('/api/exams/results',token),
   getStudentAttendanceSummaryApi(token)
  ]).then(values=>{
   if(!active)return
   const [t,h,r,a]=values
   if(t.status==='fulfilled')setLectures(t.value.entries||[])
   if(h.status==='fulfilled')setHomework(h.value.data||[])
   if(r.status==='fulfilled')setResults(r.value.data||[])
   if(a.status==='fulfilled')setAttendance(a.value)
   const failed=values.filter(v=>v.status==='rejected')
   if(failed.length)setError('Some dashboard information could not be loaded. Open the relevant page to retry.')
  }).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[token,today])
 const pendingHomework=homework.filter(item=>item.status==='published')
 const average=results.length?Math.round(results.reduce((sum,item)=>sum+(Number(item.totalMarks)>0?(Number(item.score||0)/Number(item.totalMarks))*100:0),0)/results.length):null
 return <>
  {error&&<p className="workflow-alert" role="status">{error}</p>}
  <div className="stats">
   <Stat icon={CalendarDays} label="Today's lectures" value={loading?'…':String(lectures.length)} detail="From your published timetable"/>
   <Stat icon={CheckCircle2} label="Attendance" value={attendance?attendance.percentage+'%':'—'} detail={attendance?attendance.present+' present · '+attendance.absent+' absent':'No attendance summary available'}/>
   <Stat icon={ClipboardList} label="Homework" value={loading?'…':String(pendingHomework.length)} detail="Published assignments for your class"/>
   <Stat icon={Trophy} label="Average score" value={average===null?'—':average+'%'} detail={results.length+' published result'+(results.length===1?'':'s')}/>
  </div>
  <div className="grid-main">
   <Card title="Today's lectures" action="Full timetable" onAction={()=>go('timetable')}>
    <div className="schedule">{loading?<p className="people-state"><LoaderCircle size={16}/> Loading timetable…</p>:lectures.length?lectures.map((item,index)=><div className="schedule-row" key={item.id||item._id||index}><div className="schedule-time"><strong>{item.startTime}</strong><span>{item.endTime}</span></div><div className="schedule-copy"><strong>{item.subject}</strong><span>{item.className||'Your class'}{item.room?' · '+item.room:''}</span><small>{item.teacher?.name||'Teacher not assigned'}</small></div></div>):<div className="people-state">No lectures are scheduled for today.</div>}</div>
   </Card>
   <Card title="Attendance">
    <div className="qr-card"><div className="qr-box"><QrCode size={55}/></div><div><h3>Mark lecture attendance</h3><p>Scan the active QR code shown by your teacher or principal.</p><button className="primary" onClick={()=>go('attendance')}>Open scanner</button></div></div>
   </Card>
  </div>
  <div className="quick-grid three">
   <Quick icon={ClipboardList} title="View homework" text={pendingHomework.length+' published assignment'+(pendingHomework.length===1?'':'s')} onClick={()=>go('homework')}/>
   <Quick icon={Trophy} title="My results" text={results.length+' published result'+(results.length===1?'':'s')} onClick={()=>go('results')}/>
   <Quick icon={MessageSquare} title="School notices" text="View notices sent to your account" onClick={()=>go('notices')}/>
  </div>
 </>
}
function Parent({go}){
 const {token,user}=useAuth()
 const children=user?.children||[]
 const [homework,setHomework]=useState([])
 const [notices,setNotices]=useState([])
 const [results,setResults]=useState([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{
  if(!token)return
  let active=true
  Promise.allSettled([api.get('/api/homework',token),listNoticesApi(token),api.get('/api/exams/results',token)]).then(values=>{
   if(!active)return
   if(values[0].status==='fulfilled')setHomework(values[0].value.data||[])
   if(values[1].status==='fulfilled')setNotices(values[1].value.notices||[])
   if(values[2].status==='fulfilled')setResults(values[2].value.data||[])
   if(values.some(v=>v.status==='rejected'))setError('Some family updates could not be loaded. Open the relevant page to retry.')
  }).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[token])
 return <>
  {error&&<p className="workflow-alert" role="status">{error}</p>}
  <div className="stats">
   <Stat icon={Users} label="Linked children" value={String(children.length)} detail="Students linked to your parent account"/>
   <Stat icon={ClipboardList} label="Published homework" value={loading?'…':String(homework.length)} detail="Across linked children"/>
   <Stat icon={MessageSquare} label="Notices" value={loading?'…':String(notices.length)} detail="Messages addressed to your account"/>
   <Stat icon={Trophy} label="Published results" value={loading?'…':String(results.length)} detail="Results shared with your account"/>
  </div>
  <div className="grid-main">
   <Card title="Children overview" action="View children" onAction={()=>go('children')}>
    <div className="child-list">{children.length?children.map(child=><div className="child-row" key={child.id||child._id}><span className="avatar green">{(child.name||'?').charAt(0).toUpperCase()}</span><div><strong>{child.name}</strong><small>{child.className|| (child.std?'Class '+child.std:'Class not assigned')}{child.division?' · Division '+child.division:''}</small></div></div>):<div className="people-state">No students are linked to this parent account yet.</div>}</div>
   </Card>
   <Card title="Latest notice" action="View notices" onAction={()=>go('notices')}>
    {loading?<p className="people-state"><LoaderCircle size={16}/> Loading notices…</p>:notices.length?<div className="notice-card"><div className="notice-icon"><MessageSquare size={19}/></div><div><span>{notices[0].createdAt?new Date(notices[0].createdAt).toLocaleDateString('en-IN'):'SCHOOL NOTICE'}</span><h3>{notices[0].title}</h3><p>{notices[0].message}</p></div></div>:<div className="people-state">No notices have been sent to your account.</div>}
   </Card>
  </div>
  <div className="quick-grid three">
   <Quick icon={ClipboardList} title="Children's homework" text={homework.length+' published assignment'+(homework.length===1?'':'s')} onClick={()=>go('homework')}/>
   <Quick icon={CalendarDays} title="Attendance" text="View attendance information" onClick={()=>go('attendance')}/>
   <Quick icon={Trophy} title="Results" text="View published exam results" onClick={()=>go('results')}/>
  </div>
 </>
}
export default function OverviewPage(){const {role,go}=useOutletContext();return role==='principal'?<Principal go={go}/>:role==='teacher'?<Teacher go={go}/>:role==='student'?<Student go={go}/>:<Parent go={go}/>}
