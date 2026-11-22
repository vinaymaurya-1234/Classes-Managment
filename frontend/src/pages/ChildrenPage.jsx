import { Users } from 'lucide-react'
import { SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'

export default function ChildrenPage() {
  const { user } = useAuth()
  const children = user?.children || []

  return <>
    <SectionIntro eyebrow="FAMILY" title="My children" text="View the students linked to your parent account." />
    {children.length ? <div className="child-grid">
      {children.map(child => <article className="card" key={child.id}>
        <div className="person-detail-hero">
          <span className="avatar green">{(child.name || '?')[0].toUpperCase()}</span>
          <div>
            <h2>{child.name}</h2>
            <p>{child.className || (child.std ? `Class ${child.std}` : 'Class not assigned')}{child.division ? ` · Division ${child.division}` : ''}</p>
          </div>
        </div>
        <div className="person-detail-grid">
          <div><span>Student email</span><strong>{child.email || '—'}</strong></div>
          <div><span>Standard</span><strong>{child.std || '—'}</strong></div>
        </div>
      </article>)}
    </div> : <div className="card people-state"><Users size={20}/><p>No children are linked to this parent account yet. Please contact the school office.</p></div>}
  </>
}
