import { Child, SectionIntro } from '../components/common/UI'
import { children } from '../data/mockData'
export default function ChildrenPage(){return <><SectionIntro eyebrow="FAMILY" title="My children" text="Follow attendance, results, fees and learning progress."/><div className="child-grid">{children.map(x=><div className="card" key={x.name}><Child {...x}/></div>)}</div></>}
