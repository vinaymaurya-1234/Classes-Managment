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
      setDeleteNotice(`Class ${item.standard} - ${usedDivision} is already in use and cannot be deleted.`)
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
      setDeleteNotice(`Class ${item.standard} - ${division} is already in use and cannot be deleted.`)
      return
    }
    updateStandard(id,{divisions:(item?.divisions||[]).filter((_,i)=>i!==index)})
  }
  const totalDivisions = useMemo(()=>standards.reduce((sum,item)=>sum+item.divisions.filter(v=>v.trim()).length,0),[standards])
  const save = async event => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      const normalized=standards.map(item=>({standard:Number(item.standard),label:`Class ${item.standard}`,divisions:item.divisions.map(v=>v.trim().toUpperCase()).filter(Boolean)}))
      const result=await saveClassStructureApi(token,normalized)
      const grouped=new Map()
      result.classes.forEach(item=>{if(!grouped.has(item.standard))grouped.set(item.standard,{id:String(item.standard),standard:String(item.standard),label:item.standardLabel,divisions:[],usageByDivision:{}});grouped.get(item.standard).divisions.push(item.division);grouped.get(item.standard).usageByDivision[item.division]=item.usage})
      setStandards([...grouped.values()].sort((a,b)=>Number(a.standard)-Number(b.standard)))
      setSuccess('Class structure saved. Class selections across the system can now use these divisions.')
    } catch(err){setError(err.message||'Unable to save class structure.')} finally{setSaving(false)}
  }
  if(role!=='principal') return <Card title="Class Structure"><p>Only the principal can manage the school class structure.</p></Card>
  return <>
    <main className="class-structure-v2">
      <header className="class-structure-v2-head">
        <div><span>SETTINGS / ACADEMICS</span><h1>Classes & divisions</h1><p>Manage the standards and sections available in your school.</p></div>
        <button type="button" className="class-structure-v2-add" onClick={addStandard}><Plus size={16}/> Add class</button>
      </header>
      <section className="class-structure-v2-overview">
        <div><span>CLASSES</span><strong>{standards.length.toString().padStart(2,"0")}</strong></div>
        <i/>
        <div><span>DIVISIONS</span><strong>{totalDivisions.toString().padStart(2,"0")}</strong></div>
        <p>Changes apply to admission and class assignment throughout the system.</p>
      </section>
      {deleteNotice&&<div className="class-structure-v2-alert error" role="alert">{deleteNotice}</div>}
      {error&&<div className="class-structure-v2-alert error" role="alert">{error}</div>}
      {success&&<div className="class-structure-v2-alert success" role="status">{success}</div>}
      <section className="class-structure-v2-panel">
        <div className="class-structure-v2-panel-head"><div><h2>School structure</h2><p>{standards.length? "Select a class to edit its divisions.": "Add your first class to get started."}</p></div><span>{standards.length} configured</span></div>
        {loading?<div className="class-structure-v2-loading"><LoaderCircle className="spin" size={19}/> Loading school structure</div>:standards.length===0?<div className="class-structure-v2-empty"><School size={30}/><strong>No classes configured</strong><p>Start by adding a class and its divisions.</p><button type="button" className="class-structure-v2-add" onClick={addStandard}><Plus size={15}/> Add first class</button></div>:<form onSubmit={save}>
          <div className="class-structure-v2-list">
            {standards.map((item,index)=><article className="class-structure-v2-row" key={item.id}>
              <div className="class-structure-v2-number"><small>CLASS</small><strong>{item.standard||"—"}</strong></div>
              <div className="class-structure-v2-main">
                <div className="class-structure-v2-divisions"><div><strong>Divisions</strong><small>{item.divisions.filter(v=>v.trim()).length} sections</small></div><div className="class-structure-v2-chips">{item.divisions.map((division,divisionIndex)=><label className="class-structure-v2-chip" key={divisionIndex}><input aria-label={"Division "+(divisionIndex+1)+" for class "+item.standard} value={division} maxLength={8} placeholder="A" required onChange={e=>updateDivision(item.id,divisionIndex,e.target.value)}/><button type="button" onClick={()=>removeDivision(item.id,divisionIndex)} aria-label="Remove division" title="Remove division"><X size={13}/></button></label>)}<button type="button" className="class-structure-v2-add-division" onClick={()=>addDivision(item.id)}><Plus size={14}/> Add division</button></div></div>
              </div>
              <button type="button" className="class-structure-v2-remove" onClick={()=>removeStandard(item.id)} aria-label={"Remove class "+item.standard} title="Remove class"><Trash2 size={16}/></button>
            </article>)}
          </div>
          <footer className="class-structure-v2-footer"><div><strong>Ready to update?</strong><span>Save to apply your changes across the school.</span></div><button type="submit" disabled={saving||!standards.length}>{saving?<LoaderCircle size={16} className="spin"/>:<Save size={16}/>} {saving?"Saving…":"Save changes"}</button></footer>
        </form>}
      </section>
    </main>
  </>
}
