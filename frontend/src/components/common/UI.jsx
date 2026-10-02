import { ChevronRight } from 'lucide-react'

export function Stat({icon:Icon,label,value,detail}) {
  return <div className="stat-card"><div className="stat-icon"><Icon size={19}/></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}
export function Card({title,action,onAction,children}) {
  return <section className="card"><div className="card-head"><h2>{title}</h2>{action && <button onClick={onAction}>{action}<ChevronRight size={14}/></button>}</div>{children}</section>
}
export function ScheduleRow({time,subject,teacher,room,status}) {
  return <div className="schedule-row"><time>{time}</time><div className="schedule-line"/><div className="schedule-info"><strong>{subject}</strong><span>{teacher} · {room}</span></div><em className={status}>{status==='live'?'Live now':'Upcoming'}</em></div>
}
export function Quick({icon:Icon,title,text,onClick}) {
  return <button className="quick-card" onClick={onClick}><span><Icon size={19}/></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={15}/></button>
}
export function Attention({icon:Icon,title,text,tone}) {
  return <div className="attention-row"><span className={tone}><Icon size={17}/></span><div><strong>{title}</strong><p>{text}</p></div><ChevronRight size={15}/></div>
}
export function Child({name,className,attendance,score}) {
  return <div className="child-row"><div className="avatar green">{name[0]}</div><div><strong>{name}</strong><span>{className}</span></div><div className="child-metric"><small>Attendance</small><b>{attendance}</b></div><div className="child-metric"><small>Average</small><b>{score}</b></div></div>
}
export function SectionIntro({eyebrow,title,text,children}) {
  return <div className="section-intro"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>{children}</div>
}
