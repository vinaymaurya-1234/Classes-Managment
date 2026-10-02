import { useMemo, useState } from 'react'
import {
  Bell, BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardList,
  CreditCard, GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquare,
  PlayCircle, QrCode, Search, Settings, ShieldCheck, Trophy, UserPlus, Users, X
} from 'lucide-react'
import './App.css'

const roles = {
  principal: { label: 'Principal', color: 'Forest control', icon: ShieldCheck },
  teacher: { label: 'Teacher', color: 'Teaching workspace', icon: BookOpen },
  student: { label: 'Student', color: 'Learning space', icon: GraduationCap },
  parent: { label: 'Parent', color: 'Family view', icon: Users },
}

const nav = {
  principal: [['Overview','overview'],['Students','students'],['Teachers','teachers'],['Timetable','timetable'],['Attendance','attendance'],['Fees','fees'],['Exams & Results','results'],['Notices','notices']],
  teacher: [['Overview','overview'],['My Classes','classes'],['Chapters','chapters'],['Timetable','timetable'],['My Attendance','attendance'],['Homework','homework'],['Tests & Marks','results']],
  student: [['Overview','overview'],["Today's Lectures",'timetable'],['Attendance','attendance'],['Homework','homework'],['Tests & Results','results'],['Notices','notices']],
  parent: [['Overview','overview'],['My Children','children'],['Fees','fees'],['Attendance','attendance'],['Tests & Reports','results'],['Notices','notices'],['Timetable','timetable']],
}

const today = [
  { time:'08:00', subject:'Mathematics', teacher:'Ms. Priya', room:'Room 04', status:'upcoming' },
  { time:'10:00', subject:'Physics', teacher:'Mr. Arjun', room:'Room 02', status:'live' },
  { time:'12:00', subject:'Chemistry', teacher:'Ms. Neha', room:'Lab 01', status:'upcoming' },
  { time:'16:00', subject:'Biology', teacher:'Mr. Rohan', room:'Room 03', status:'upcoming' },
]

const students = [
  { name:'Aarav Sharma', className:'12th Science', attendance:94, fee:'Paid', score:88 },
  { name:'Ananya Patel', className:'11th Science', attendance:91, fee:'Pending', score:82 },
  { name:'Vivaan Shah', className:'12th Science', attendance:87, fee:'Paid', score:79 },
  { name:'Diya Mehta', className:'10th Science', attendance:96, fee:'Paid', score:91 },
]

function App() {
  const [role,setRole] = useState('principal')
  const [page,setPage] = useState('overview')
  const [mobileNav,setMobileNav] = useState(false)
  const [search,setSearch] = useState('')
  const [chapterStarted,setChapterStarted] = useState(false)
  const roleInfo = roles[role]
  const RoleIcon = roleInfo.icon
  const filteredStudents = useMemo(() => students.filter(item => item.name.toLowerCase().includes(search.toLowerCase())), [search])
  const go = next => { setPage(next); setMobileNav(false) }

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (mobileNav ? 'open' : '')}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={21}/></div>
          <div><strong>ClassLeaf</strong><span>Tuition management</span></div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button>
        </div>
        <div className="role-switcher">
          <span>VIEW AS</span>
          <select value={role} onChange={e => {setRole(e.target.value);setPage('overview')}}>
            {Object.entries(roles).map(([key,item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
        </div>
        <nav>
          <div className="nav-caption">WORKSPACE</div>
          {nav[role].map(([label,key]) => (
            <button key={key} className={page === key ? 'nav-item active' : 'nav-item'} onClick={() => go(key)}>
              <NavIcon name={key}/><span>{label}</span>{page === key && <ChevronRight size={14}/>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><Settings size={17}/><span>Settings</span></button>
          <button className="nav-item"><LogOut size={17}/><span>Sign out</span></button>
          <div className="sidebar-profile"><div className="avatar">R</div><div><strong>{roleInfo.label}</strong><span>{roleInfo.color}</span></div></div>
        </div>
      </aside>
      {mobileNav && <button className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={20}/></button>
          <div className="breadcrumb"><span>ClassLeaf</span><ChevronRight size={13}/><strong>{nav[role].find(item => item[1] === page)?.[0] || 'Overview'}</strong></div>
          <div className="topbar-actions">
            <div className="search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students, classes..."/></div>
            <button className="icon-button"><Bell size={18}/><i/></button>
            <div className="top-avatar">{roleInfo.label[0]}</div>
          </div>
        </header>
        <div className="content">
          <div className="role-banner">
            <div><span className="eyebrow">{role === 'principal' ? 'ADMINISTRATION' : role.toUpperCase()}</span><h1>{greeting(role)}</h1><p>{roleDescription(role)}</p></div>
            <div className="date-chip"><CalendarDays size={16}/><span>Wednesday, 2 October 2026</span></div>
          </div>
          {page === 'overview' && <Overview role={role} go={go}/>}
          {page === 'timetable' && <Timetable role={role}/>}
          {page === 'attendance' && <Attendance role={role}/>}
          {page === 'homework' && <Homework role={role}/>}
          {page === 'chapters' && <Chapters started={chapterStarted} setStarted={setChapterStarted}/>}
          {page === 'fees' && <Fees role={role}/>}
          {page === 'results' && <Results role={role}/>}
          {page === 'students' && <People title="Students" type="student" data={filteredStudents}/>}
          {page === 'teachers' && <People title="Teachers" type="teacher" data={filteredStudents.map((x,i) => ({...x,name:['Priya Nair','Arjun Rao','Neha Kulkarni','Rohan Desai'][i],className:'Faculty'}))}/>}
          {page === 'classes' && <People title="My Classes" type="student" data={filteredStudents}/>}
          {page === 'children' && <Children/>}
          {page === 'notices' && <Notices/>}
        </div>
      </main>
    </div>
  )
}

function NavIcon({name}) {
  const icons={overview:LayoutDashboard,students:Users,teachers:Users,timetable:CalendarDays,attendance:CheckCircle2,fees:CreditCard,results:Trophy,notices:MessageSquare,classes:BookOpen,chapters:BookOpen,homework:ClipboardList,children:Users}
  const Icon=icons[name] || LayoutDashboard
  return <Icon size={17}/>
}
function greeting(role){return {principal:'Good morning, Principal.',teacher:'Ready for today’s lessons?',student:'Good morning, Aarav.',parent:'Welcome back.'}[role]}
function roleDescription(role){return {principal:'Everything happening across your tuition centre, in one calm view.',teacher:'Manage your chapters, lectures, attendance and student work.',student:'Your lectures, attendance, homework and results are all here.',parent:'Stay connected with your child’s learning and school updates.'}[role]}
function Overview({role,go}){if(role==='student')return <StudentOverview go={go}/>;if(role==='parent')return <ParentOverview go={go}/>;if(role==='teacher')return <TeacherOverview go={go}/>;return <PrincipalOverview go={go}/>}

function PrincipalOverview({go}){return <>
  <div className="stats"><Stat icon={Users} label="Total students" value="248" detail="+12 this month"/><Stat icon={BookOpen} label="Active teachers" value="18" detail="16 present today"/><Stat icon={CheckCircle2} label="Today's attendance" value="94.2%" detail="+2.4% vs last week"/><Stat icon={CreditCard} label="Fees collected" value="₹8.42L" detail="₹1.18L pending"/></div>
  <div className="grid-main"><Card title="Today's schedule" action="View timetable" onAction={()=>go('timetable')}><div className="schedule">{today.map(item=><ScheduleRow key={item.time} {...item}/>)}</div></Card><Card title="Needs attention"><div className="attention"><Attention icon={CreditCard} title="Fee payments" text="23 students have pending fees" tone="amber"/><Attention icon={Users} title="Attendance" text="8 students below 75% attendance" tone="red"/><Attention icon={ClipboardList} title="Homework" text="5 classes have overdue homework" tone="green"/></div></Card></div>
  <div className="quick-grid"><Quick icon={CalendarDays} title="Set timetable" text="Plan daily, weekly or monthly lectures" onClick={()=>go('timetable')}/><Quick icon={UserPlus} title="Add people" text="Create student, teacher or parent records" onClick={()=>go('students')}/><Quick icon={CreditCard} title="Manage fees" text="Track paid and pending fees" onClick={()=>go('fees')}/><Quick icon={MessageSquare} title="Send notice" text="Notify parents and students" onClick={()=>go('notices')}/></div>
</>}
function TeacherOverview({go}){return <>
  <div className="stats"><Stat icon={BookOpen} label="Active chapters" value="7" detail="2 in progress today"/><Stat icon={Users} label="My students" value="86" detail="Across 4 classes"/><Stat icon={CheckCircle2} label="My attendance" value="100%" detail="Present this month"/><Stat icon={ClipboardList} label="Homework" value="12" detail="4 awaiting review"/></div>
  <div className="grid-main"><Card title="Today's teaching" action="Full timetable" onAction={()=>go('timetable')}><div className="schedule">{today.slice(0,3).map(item=><ScheduleRow key={item.time} {...item}/>)}</div></Card><Card title="Chapter in progress"><div className="chapter-focus"><div className="chapter-icon"><PlayCircle size={23}/></div><div><span>PHYSICS · CLASS 12</span><h3>Electrostatics</h3><p>Chapter 4 · 62% completed</p></div><button onClick={()=>go('chapters')}>Continue</button></div></Card></div>
  <div className="quick-grid three"><Quick icon={PlayCircle} title="Start chapter" text="Begin or continue today's chapter" onClick={()=>go('chapters')}/><Quick icon={ClipboardList} title="Give homework" text="Send a note or task to students" onClick={()=>go('homework')}/><Quick icon={CheckCircle2} title="Mark attendance" text="Record your lecture presence" onClick={()=>go('attendance')}/></div>
</>}
function StudentOverview({go}){return <>
  <div className="stats"><Stat icon={CalendarDays} label="Today's lectures" value="4" detail="Next: Physics at 10:00"/><Stat icon={CheckCircle2} label="Attendance" value="94%" detail="Excellent standing"/><Stat icon={ClipboardList} label="Homework" value="3" detail="1 due tomorrow"/><Stat icon={Trophy} label="Average score" value="88%" detail="+4% this month"/></div>
  <div className="grid-main"><Card title="Today's lectures" action="Full timetable" onAction={()=>go('timetable')}><div className="schedule">{today.map(item=><ScheduleRow key={item.time} {...item}/>)}</div></Card><Card title="Quick attendance"><div className="qr-card"><div className="qr-box"><QrCode size={55}/></div><div><h3>Mark lecture attendance</h3><p>Scan the QR code shown by your teacher when you enter the class.</p><button className="primary" onClick={()=>go('attendance')}>Open scanner <ChevronRight size={15}/></button></div></div></Card></div>
  <div className="quick-grid three"><Quick icon={ClipboardList} title="View homework" text="3 assignments need your attention" onClick={()=>go('homework')}/><Quick icon={Trophy} title="My results" text="See test marks and reports" onClick={()=>go('results')}/><Quick icon={MessageSquare} title="School notices" text="2 new messages from the principal" onClick={()=>go('notices')}/></div>
</>}
function ParentOverview({go}){return <>
  <div className="stats"><Stat icon={Users} label="Children" value="2" detail="Both enrolled"/><Stat icon={CreditCard} label="Fees pending" value="₹18,500" detail="Due 10 October"/><Stat icon={CheckCircle2} label="Attendance" value="92%" detail="Average across children"/><Stat icon={Trophy} label="Latest average" value="86%" detail="+3% this term"/></div>
  <div className="grid-main"><Card title="Children overview" action="View children" onAction={()=>go('children')}><div className="child-list"><Child name="Aarav Sharma" className="12th Science" attendance="94%" score="88%"/><Child name="Anaya Sharma" className="9th Science" attendance="90%" score="84%"/></div></Card><Card title="Important notice"><div className="notice-card"><div className="notice-icon"><Bell size={19}/></div><div><span>FROM PRINCIPAL · TODAY</span><h3>Parent meeting this Saturday</h3><p>We will discuss mid-term performance and upcoming test schedule.</p><button onClick={()=>go('notices')}>Read notice <ChevronRight size={14}/></button></div></div></Card></div>
  <div className="quick-grid three"><Quick icon={CreditCard} title="Fee details" text="View paid and pending fees" onClick={()=>go('fees')}/><Quick icon={Trophy} title="Test reports" text="Review marks and performance" onClick={()=>go('results')}/><Quick icon={MessageSquare} title="Notices" text="Messages from your tuition centre" onClick={()=>go('notices')}/></div>
</>}

function Stat({icon:Icon,label,value,detail}){return <div className="stat-card"><div className="stat-icon"><Icon size={19}/></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>}
function Card({title,action,onAction,children}){return <section className="card"><div className="card-head"><h2>{title}</h2>{action&&<button onClick={onAction}>{action}<ChevronRight size={14}/></button>}</div>{children}</section>}
function ScheduleRow({time,subject,teacher,room,status}){return <div className="schedule-row"><time>{time}</time><div className="schedule-line"/><div className="schedule-info"><strong>{subject}</strong><span>{teacher} · {room}</span></div><em className={status}>{status==='live'?'Live now':'Upcoming'}</em></div>}
function Attention({icon:Icon,title,text,tone}){return <div className="attention-row"><span className={tone}><Icon size={17}/></span><div><strong>{title}</strong><p>{text}</p></div><ChevronRight size={15}/></div>}
function Quick({icon:Icon,title,text,onClick}){return <button className="quick-card" onClick={onClick}><span><Icon size={19}/></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={15}/></button>}
function Child({name,className,attendance,score}){return <div className="child-row"><div className="avatar green">{name[0]}</div><div><strong>{name}</strong><span>{className}</span></div><div className="child-metric"><small>Attendance</small><b>{attendance}</b></div><div className="child-metric"><small>Average</small><b>{score}</b></div></div>}

function Timetable({role}){return <><div className="section-intro"><div><span className="eyebrow">SCHEDULE</span><h2>{role==='student'||role==='parent'?"Today's lectures":'Lecture timetable'}</h2><p>{role==='principal'?'Set and publish lectures for classes and teachers.':'Your published teaching and learning schedule.'}</p></div><button className="primary"><CalendarDays size={16}/>{role==='principal'?'Add lecture':'This week'}</button></div><Card title="Wednesday · 2 October"><div className="schedule large">{today.map(item=><ScheduleRow key={item.time} {...item}/>)}</div></Card></>}

function Attendance({role}){if(role==='student')return <><div className="section-intro"><div><span className="eyebrow">ATTENDANCE</span><h2>Mark your attendance</h2><p>Scan the classroom QR code to register your presence.</p></div></div><div className="attendance-grid"><section className="scanner-card"><div className="scanner-frame"><QrCode size={105}/><span>QR SCANNER</span></div><button className="primary big">Open camera & scan</button><p>Your attendance is only recorded for an active lecture.</p></section><Card title="Attendance summary"><div className="attendance-summary"><strong>94%</strong><span>Excellent attendance</span><div className="progress"><i style={{width:'94%'}}/></div><p>47 present · 3 absent · 50 lectures</p></div></Card></div></>;return <><div className="section-intro"><div><span className="eyebrow">ATTENDANCE</span><h2>{role==='teacher'?'Your lecture attendance':'Attendance overview'}</h2><p>{role==='teacher'?'Confirm your presence for each scheduled lecture.':'Review attendance across students and classes.'}</p></div><button className="primary"><CheckCircle2 size={16}/>Mark present</button></div><Card title={role==='teacher'?"Today's attendance":'Attendance overview'}><div className="attendance-table">{students.map(s=><div className="table-row" key={s.name}><span className="person"><span className="avatar green">{s.name[0]}</span><b>{s.name}</b></span><strong>{s.attendance}%</strong><span className="pill success">Present</span><ChevronRight size={15}/></div>)}</div></Card></>}

function Homework({role}){const rows=role==='teacher'?[['Physics · Electrostatics','Class 12','10 questions · Due 5 Oct','Published'],['Mathematics · Integrals','Class 12','Practice set · Due 6 Oct','Published'],['Chemistry · Solutions','Class 11','Read notes · Due 7 Oct','Draft']]:[['Electrostatics practice','Physics · Mr. Arjun','Due tomorrow','Pending'],['Integrals worksheet','Mathematics · Ms. Priya','Due 6 Oct','Pending'],['Organic chemistry notes','Chemistry · Ms. Neha','Submitted','Completed']];return <><div className="section-intro"><div><span className="eyebrow">HOMEWORK</span><h2>{role==='teacher'?'Give students meaningful work':'Your homework'}</h2><p>{role==='teacher'?'Create a note, assignment or practice task after your lecture.':'Keep track of what your teachers have assigned.'}</p></div><button className="primary"><ClipboardList size={16}/>{role==='teacher'?'Give homework':'Refresh'}</button></div><Card title={role==='teacher'?'Recent assignments':'Assignments'}><div className="attendance-table">{rows.map((r,i)=><div className="table-row" key={i}><div><b>{r[0]}</b><small>{r[1]} · {r[2]}</small></div><span className={'pill '+(r[3]==='Completed'?'success':'neutral')}>{r[3]}</span><ChevronRight size={15}/></div>)}</div></Card></>}

function Chapters({started,setStarted}){return <><div className="section-intro"><div><span className="eyebrow">TEACHING · CHAPTERS</span><h2>Chapter progress</h2><p>Create chapters for subjects and keep one chapter active until it is completed.</p></div><button className="primary"><BookOpen size={16}/>New chapter</button></div><div className="chapter-layout"><Card title="Current chapter"><div className="active-chapter"><div className="chapter-top"><div><span>PHYSICS · CLASS 12</span><h2>Electrostatics</h2><p>Chapter 4 · Started 30 September</p></div><span className="pill success">{started?'Started':'Ready'}</span></div><div className="progress large"><i style={{width:'62%'}}/></div><div className="chapter-meta"><span>62% completed</span><span>3 sessions logged</span></div><div className="chapter-actions">{!started?<button className="primary" onClick={()=>setStarted(true)}><PlayCircle size={16}/>Start chapter</button>:<><button className="secondary"><ClipboardList size={16}/>Add session note</button><button className="primary"><CheckCircle2 size={16}/>Mark chapter completed</button></>}</div></div></Card><Card title="My chapters"><div className="chapter-list"><div><b>Electrostatics</b><span>Physics · 62%</span><i className="pill success">Started</i></div><div><b>Integrals</b><span>Mathematics · 100%</span><i className="pill neutral">Completed</i></div><div><b>Solutions</b><span>Chemistry · 24%</span><i className="pill neutral">Not started</i></div></div></Card></div></>}

function Fees({role}){return <><div className="stats"><Stat icon={CreditCard} label="Total fees" value="₹2.40L" detail="Current academic year"/><Stat icon={CheckCircle2} label="Paid" value="₹2.06L" detail="85.8% collected"/><Stat icon={CreditCard} label="Pending" value="₹34,000" detail="12 students"/><Stat icon={CalendarDays} label="Next due" value="10 Oct" detail="Fee cycle · October"/></div><Card title={role==='parent'?'Fee details':'Student fee records'}><div className="attendance-table">{students.map(s=><div className="table-row" key={s.name}><span className="person"><span className="avatar green">{s.name[0]}</span><b>{s.name}</b></span><span>{s.className}</span><b>{s.fee==='Paid'?'₹20,000 paid':'₹20,000 pending'}</b><span className={'pill '+(s.fee==='Paid'?'success':'warning')}>{s.fee}</span></div>)}</div></Card></>}

function Results({role}){const marks=[88,92,81,89];return <><div className="section-intro"><div><span className="eyebrow">ACADEMICS</span><h2>{role==='parent'?'Test reports':role==='student'?'My results':'Tests & results'}</h2><p>Track assessments, marks and academic performance.</p></div><button className="primary"><Trophy size={16}/>New test</button></div><div className="result-grid">{['Physics','Mathematics','Chemistry','Biology'].map((subject,i)=><div className="result-card" key={subject}><span>{subject}</span><strong>{marks[i]}%</strong><small>Mid-term test · 1 Oct</small><div className="progress"><i style={{width:marks[i]+'%'}}/></div></div>)}</div></>}

function People({title,type,data}){return <><div className="section-intro"><div><span className="eyebrow">MANAGEMENT</span><h2>{title}</h2><p>Manage {type==='student'?'student records and academic details':'faculty and teaching assignments'}.</p></div><button className="primary"><UserPlus size={16}/>Add {type}</button></div><Card title={title+' directory'}><div className="attendance-table">{data.map(s=><div className="table-row" key={s.name}><span className="person"><span className="avatar green">{s.name[0]}</span><div><b>{s.name}</b><small>{s.className}</small></div></span><strong>{s.attendance}% attendance</strong><span className="pill success">Active</span><ChevronRight size={15}/></div>)}</div></Card></>}

function Children(){return <><div className="section-intro"><div><span className="eyebrow">FAMILY</span><h2>My children</h2><p>Follow attendance, results, fees and learning progress.</p></div></div><div className="child-grid"><Child name="Aarav Sharma" className="12th Science" attendance="94%" score="88%"/><Child name="Anaya Sharma" className="9th Science" attendance="90%" score="84%"/></div></>}
function Notices(){return <><div className="section-intro"><div><span className="eyebrow">COMMUNICATION</span><h2>School notices</h2><p>Important messages from your tuition centre.</p></div><button className="primary"><MessageSquare size={16}/>New notice</button></div><div className="notice-list"><div className="notice-card"><div className="notice-icon"><Bell size={19}/></div><div><span>PRINCIPAL · TODAY</span><h3>Parent meeting this Saturday</h3><p>Mid-term performance discussion and upcoming test schedule.</p></div></div><div className="notice-card"><div className="notice-icon"><CalendarDays size={19}/></div><div><span>ACADEMICS · YESTERDAY</span><h3>October timetable published</h3><p>Students can now view their lectures from the timetable section.</p></div></div></div></>}

export default App
