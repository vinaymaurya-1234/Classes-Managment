import { CalendarDays } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, ScheduleRow, SectionIntro } from '../components/common/UI'
import { todayLectures } from '../data/mockData'
export default function TimetablePage(){const {role}=useOutletContext();return <><SectionIntro eyebrow="SCHEDULE" title={role==='student'||role==='parent'?"Today's lectures":'Lecture timetable'} text={role==='principal'?'Set and publish lectures for classes and teachers.':'Your published teaching and learning schedule.'}><button className="primary"><CalendarDays size={16}/>{role==='principal'?'Add lecture':'This week'}</button></SectionIntro><Card title="Friday · 2 October"><div className="schedule large">{todayLectures.map(x=><ScheduleRow key={x.time} {...x}/>)}</div></Card></>}
