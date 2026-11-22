import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, LoaderCircle, School, Layers3, X } from 'lucide-react'
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
  const [deleteNotice, setDeleteNotice] = useState('')
  useEffect(() => {
    if (!deleteNotice) return
    const timer = setTimeout(() => setDeleteNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [deleteNotice])
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
    const usedDivision = item?.divisions.find(division => item.usageByDivision?.[division]?.inUse)
    if (usedDivision) {
      setDeleteNotice(`${item.label || `Class ${item.standard}`} - ${usedDivision} is already in use and cannot be deleted.`)
      return
    }
    setStandards(current=>current.filter(standard=>standard.id!==id))
  }
  const addDivision = id => updateStandard(id,{divisions:[...(standards.find(item=>item.id===id)?.divisions||[]),'']})
  const updateDivision = (id,index,value) => updateStandard(id,{divisions:(standards.find(item=>item.id===id)?.divisions||[]).map((division,i)=>i===index?value.toUpperCase():division)})
  const removeDivision = (id,index) => {
    const item = standards.find(standard => standard.id === id)
    const division = item?.divisions[index]
    if (item?.usageByDivision?.[division]?.inUse) {
      setDeleteNotice(`${item.label || `Class ${item.standard}`} - ${division} is already in use and cannot be deleted.`)
      return
    }
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
    <section className="class-structure-page">
      <header className="class-structure-hero">
        <div className="class-structure-hero-copy"><span className="class-structure-kicker">ACADEMIC CONFIGURATION</span><h1>Class structure</h1><p>Organise your standards and divisions in one place. These settings are used across student admissions, teacher assignments and class filters.</p></div>
        <div className="class-structure-hero-icon"><School size={34}/></div>
      </header>
      <div className="class-structure-metrics">
        <article><span className="class-structure-metric-icon"><Layers3 size={18}/></span><div><strong>{standards.length}</strong><span>Standards configured</span></div></article>
        <article><span className="class-structure-metric-icon"><School size={18}/></span><div><strong>{totalDivisions}</strong><span>Divisions available</span></div></article>
      </div>
      {deleteNotice&&<div className="class-structure-alert danger" role="alert">{deleteNotice}</div>}
      {error&&<div className="class-structure-alert danger" role="alert">{error}</div>}
      {success&&<div className="class-structure-alert success" role="status">{success}</div>}
      <section className="class-structure-workspace">
        <div className="class-structure-workspace-head"><div><span className="class-structure-kicker">YOUR SCHOOL</span><h2>Standards & divisions</h2><p>Add each class and define the divisions available under it.</p></div><button type="button" className="class-structure-add" onClick={addStandard}><Plus size={16}/> Add standard</button></div>
        {loading?<div className="class-structure-loading"><LoaderCircle className="spin" size={20}/>Loading class structure…</div>:<form className="class-structure-form" onSubmit={save}>
          {standards.length===0?<div className="class-structure-empty"><span><School size={25}/></span><strong>No standards added yet</strong><p>Start by adding the first class in your school.</p><button type="button" className="class-structure-add" onClick={addStandard}><Plus size={16}/> Add first standard</button></div>:<div className="class-structure-grid">
            {standards.map((item,index)=><section className="class-structure-card" key={item.id}>
              <header className="class-structure-card-head"><span className="class-structure-card-index">{String(index+1).padStart(2,'0')}</span><div><strong>{item.label|| (item.standard?'Class '+item.standard:'New standard')}</strong><small>{item.divisions.filter(v=>v.trim()).length} divisions</small></div><button type="button" className="class-structure-delete" onClick={()=>removeStandard(item.id)} title="Remove standard"><Trash2 size={16}/></button></header>
              <div className="class-structure-fields">
                <label>Standard number<input type="number" min="1" max="12" required value={item.standard} onChange={e=>updateStandard(item.id,{standard:e.target.value,label:item.label.replace(/\d+/,e.target.value)})} placeholder="e.g. 11"/></label>
                <label>Display name<input value={item.label} onChange={e=>updateStandard(item.id,{label:e.target.value})} placeholder="e.g. Class 11"/></label>
              </div>
              <div className="class-structure-divisions-new"><div className="class-structure-divisions-heading"><div><strong>Divisions</strong><small>Sections within this standard</small></div><span>{item.divisions.filter(v=>v.trim()).length} total</span></div>
                <div className="class-structure-chip-list">{item.divisions.map((division,index)=><label className="class-structure-chip" key={index}><input aria-label={"Division "+(index+1)+" for class "+item.standard} value={division} maxLength={8} onChange={e=>updateDivision(item.id,index,e.target.value)} placeholder="A" required/><button type="button" onClick={()=>removeDivision(item.id,index)} aria-label="Remove division" title="Remove division"><X size={12}/></button></label>)}<button type="button" className="class-structure-add-division" onClick={()=>addDivision(item.id)}><Plus size={14}/> Add division</button></div>
              </div>
            </section>)}
          </div>}
          <footer className="class-structure-footer"><div><strong>Remember to save your changes</strong><span>Updates will apply to class selections across the system.</span></div><button type="submit" className="class-structure-save-button" disabled={saving||!standards.length}>{saving?<LoaderCircle size={16} className="spin"/>:<Save size={16}/>} {saving?'Saving changes…':'Save class structure'}</button></footer>
        </form>}
      </section>
    </section>
  </>
}
