import { useMemo, useState } from 'react'
import { Bell, BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, CreditCard, GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquare, Search, Settings, ShieldCheck, Trophy, UserPlus, Users, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { roles } from '../../data/mockData'

const nav = {
 principal:[['Overview','overview'],['Students','students'],['Teachers','teachers'],['Timetable','timetable'],['Attendance','attendance'],['Fees','fees'],['Exams & Results','results'],['Notices','notices']],
 teacher:[['Overview','overview'],['My Classes','classes'],['Chapters','chapters'],['Timetable','timetable'],['My Attendance','attendance'],['Homework','homework'],['Tests & Marks','results']],
 student:[['Overview','overview'],["Today's Lectures",'timetable'],['Attendance','attendance'],['Homework','homework'],['Tests & Results','results'],['Notices','notices']],
 parent:[['Overview','overview'],['My Children','children'],['Fees','fees'],['Attendance','attendance'],['Tests & Reports','results'],['Notices','notices'],['Timetable','timetable']],
}
const icons = { overview:LayoutDashboard, students:Users, teachers:Users, timetable:CalendarDays, attendance:CheckCircle2, fees:CreditCard, results:Trophy, notices:MessageSquare, classes:BookOpen, chapters:BookOpen, homework:ClipboardList, children:Users }

export default function AppLayout() {
  const { role: routeRole } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const role = roles[routeRole] ? routeRole : 'principal'
  const [mobileNav,setMobileNav] = useState(false)
  const [search,setSearch] = useState('')
  const info = roles[role]
  const currentKey = location.pathname.split('/')[2] || 'overview'
  const pageLabel = nav[role].find(x => x[1] === currentKey)?.[0] || 'Overview'
  const filtered = useMemo(() => search, [search])

  const goRole = next => navigate(`/${next}/overview`)
  const go = key => { navigate(`/${role}/${key}`); setMobileNav(false) }

  return <div className="app-shell">
    <aside className={'sidebar ' + (mobileNav ? 'open' : '')}>
      <div className="brand"><div className="brand-mark"><GraduationCap size={21}/></div><div><strong>ClassLeaf</strong><span>Tuition management</span></div><button className="mobile-close" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="role-switcher"><span>VIEW AS</span><select value={role} onChange={e=>goRole(e.target.value)}>{Object.entries(roles).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></div>
      <nav><div className="nav-caption">WORKSPACE</div>{nav[role].map(([label,key])=>{const Icon=icons[key]||LayoutDashboard;return <NavLink key={key} to={`/${role}/${key}`} onClick={()=>setMobileNav(false)} className={({isActive})=>'nav-item '+(isActive?'active':'')}><Icon size={17}/><span>{label}</span><ChevronRight size={14}/></NavLink>})}</nav>
      <div className="sidebar-bottom"><button className="nav-item"><Settings size={17}/><span>Settings</span></button><button className="nav-item"><LogOut size={17}/><span>Sign out</span></button><div className="sidebar-profile"><div className="avatar">R</div><div><strong>{info.label}</strong><span>{info.color}</span></div></div></div>
    </aside>
    {mobileNav && <button className="sidebar-backdrop" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb"><Link to={`/${role}/overview`}>ClassLeaf</Link><ChevronRight size={13}/><strong>{pageLabel}</strong></div><div className="topbar-actions"><div className="search"><Search size={16}/><input value={filtered} onChange={e=>setSearch(e.target.value)} placeholder="Search students, classes..."/></div><button className="icon-button"><Bell size={18}/><i/></button><div className="top-avatar">{info.label[0]}</div></div></header>
      <div className="content"><div className="role-banner"><div><span className="eyebrow">{role==='principal'?'ADMINISTRATION':role.toUpperCase()}</span><h1>{({principal:'Good morning, Principal.',teacher:'Ready for today’s lessons?',student:'Good morning, Aarav.',parent:'Welcome back.'})[role]}</h1><p>{({principal:'Everything happening across your tuition centre, in one calm view.',teacher:'Manage your chapters, lectures, attendance and student work.',student:'Your lectures, attendance, homework and results are all here.',parent:'Stay connected with your child’s learning and school updates.'})[role]}</p></div><div className="date-chip"><CalendarDays size={16}/><span>Friday, 2 October 2026</span></div></div><Outlet context={{role,search,setSearch,go}}/></div>
    </main>
  </div>
}
