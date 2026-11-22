import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, LoaderCircle, School, Layers3 } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Card, SectionIntro } from '../components/common/UI'
import { useAuth } from '../context/AuthContext'
import { listClassDivisionsApi, saveClassStructureApi } from '../api/classes.api'

const makeStandard = () => ({ id: crypto.randomUUID(), standard: '', label: '', divisions: ['A'] })

export default function ClassStructurePage() {
  const { role } = useOutletContext()
  const { token } = useAuth()
  const [standards, setStandards] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    let active = true
    listClassDivisionsApi(token).then(({ classes = [] }) => {
      if (!active) return
      const grouped = new Map()
      classes.filter(item => item.active).forEach(item => {
        if (!grouped.has(item.standard)) grouped.set(item.standard, { id: String(item.standard), standard: String(item.standard), label: item.standardLabel, divisions: [], usageByDivision: {} })
        grouped.get(item.standard).divisions.push(item.division)
        grouped.get(item.standard).usageByDivision[item.division] = item.usage
      })
      setStandards([...grouped.values()].sort((a,b)=>Number(a.standard)-Number(b.standard)))
    }).catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  }, [token])
  const updateStandard = (id, patch) => setStandards(current=>current.map(item=>item.id===id?{...item,...patch}:item))
  const addStandard = () => setStandards(current=>[...current,makeStandard()])
  const removeStandard = id => {
    const item = standards.find(standard => standard.id === id)
    if (item?.divisions.some(division => item.usageByDivision?.[division]?.inUse)) return
    setStandards(current=>current.filter(standard=>standard.id!==id))
  }
  const addDivision = id => updateStandard(id,{divisions:[...(standards.find(item=>item.id===id)?.divisions||[]),'']})
  const updateDivision = (id,index,value) => updateStandard(id,{divisions:(standards.find(item=>item.id===id)?.divisions||[]).map((division,i)=>i===index?value.toUpperCase():division)})
  const removeDivision = (id,index) => {
    const item = standards.find(standard => standard.id === id)
    const division = item?.divisions[index]
    if (item?.usageByDivision?.[division]?.inUse) return
    updateStandard(id,{divisions:(item?.divisions||[]).filter((_,i)=>i!==index)})
  }
  const totalDivisions = useMemo(()=>standards.reduce((sum,item)=>sum+item.divisions.filter(v=>v.trim()).length,0),[standards])
  const save = async event => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      const normalized=standards.map(item=>({standard:Number(item.standard),label:item.label.trim()||`Class ${item.standard}`,divisions:item.divisions.map(v=>v.trim().toUpperCase()).filter(Boolean)}))
      const result=await saveClassStructureApi(token,normalized)
      const grouped=new Map()
      result.classes.forEach(item=>{if(!grouped.has(item.standard))grouped.set(item.standard,{id:String(item.standard),standard:String(item.standard),label:item.standardLabel,divisions:[],usageByDivision:{}});grouped.get(item.standard).divisions.push(item.division);grouped.get(item.standard).usageByDivision[item.division]=item.usage})
      setStandards([...grouped.values()].sort((a,b)=>Number(a.standard)-Number(b.standard)))
      setSuccess('Class structure saved. Class selections across the system can now use these divisions.')
    } catch(err){setError(err.message||'Unable to save class structure.')} finally{setSaving(false)}
  }
  if(role!=='principal') return <Card title="Class Structure"><p>Only the principal can manage the school class structure.</p></Card>
  return <>
    <SectionIntro eyebrow="SCHOOL SETUP" title="Class Structure" text="Set up the classes and divisions available throughout your school. This becomes the central list used when assigning students and teachers."/>
    <div className="class-structure-summary"><div><School size={18}/><strong>{standards.length}</strong><span>Classes</span></div><div><Layers3 size={18}/><strong>{totalDivisions}</strong><span>Divisions</span></div></div>
    {error&&<div className="profile-message error">{error}</div>}{success&&<div className="profile-message success">{success}</div>}
    <Card title="Configure classes">
      {loading?<div className="people-state"><LoaderCircle className="spin" size={18}/>Loading class structure…</div>:<form className="class-structure-form" onSubmit={save}>
        {standards.map(item=><section className="class-structure-row" key={item.id}>
          <div className="class-structure-row-head"><div className="class-structure-label"><label>Class number<input type="number" min="1" max="12" required value={item.standard} onChange={e=>updateStandard(item.id,{standard:e.target.value,label:item.label.replace(/\d+/,e.target.value)})}/></label><label>Class display name<input value={item.label} onChange={e=>updateStandard(item.id,{label:e.target.value})} placeholder="Class 9"/></label></div><button type="button" className="danger-ghost" onClick={()=>removeStandard(item.id)} disabled={item.divisions.some(division=>item.usageByDivision?.[division]?.inUse)} title={item.divisions.some(division=>item.usageByDivision?.[division]?.inUse)?"Cannot remove: one or more divisions are in use":"Remove class"}><Trash2 size={16}/></button></div>
          <div className="class-structure-divisions"><span>Divisions</span><div>{item.divisions.map((division,index)=><label className="division-input" key={index}><input value={division} maxLength={8} onChange={e=>updateDivision(item.id,index,e.target.value)} placeholder="A" required/><button type="button" onClick={()=>removeDivision(item.id,index)} aria-label="Remove division" disabled={item.usageByDivision?.[division]?.inUse} title={item.usageByDivision?.[division]?.inUse?"Cannot remove: this division is in use":"Remove division"}><Trash2 size={12}/></button></label>)}<button type="button" className="secondary small" onClick={()=>addDivision(item.id)}><Plus size={13}/> Division</button></div></div>
        </section>)}
        <button type="button" className="secondary" onClick={addStandard}><Plus size={15}/> Add class</button>
        <div className="class-structure-save"><button type="submit" className="primary" disabled={saving||!standards.length}>{saving?<LoaderCircle size={15} className="spin"/>:<Save size={15}/>} {saving?'Saving…':'Save class structure'}</button></div>
      </form>}
    </Card>
  </>
}
