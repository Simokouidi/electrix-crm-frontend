import React, { useMemo, useState, useEffect } from 'react'
import { useStore, Client } from '../lib/store'
import Button from '../components/Button'
// removed reset icon per request
import { Eye, EyeOff, Pencil, Trash2, Plus } from 'lucide-react'
import Logo from '../Images/Logo_copy2.png'

function formatDate(d?: string | null){
  return d ? new Date(d).toLocaleDateString() : '-'
}

function toDateInputValue(v?: string | null){
  if(!v) return ''
  const d = new Date(v)
  if(Number.isNaN(d.getTime())) return ''
  return d.toISOString().substr(0,10)
}

function toDateTimeLocalValue(v?: string | null){
  if(!v) return ''
  const d = new Date(v)
  if(Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0,16)
}

function maskEmail(email?: string){
  if(!email) return '-'
  const [user, domain] = email.split('@')
  if(!user || !domain) return '—'
  const first = user[0]
  return `${first}${'•'.repeat(Math.max(0, 4))}@${domain}`
}

function StatusBadge({ value }: { value?: string | null }){
  const v = String(value || '').toLowerCase()
  const map: Record<string, { cls: string; label: string }> = {
    'planned': { cls: 'bg-slate-100 text-slate-700 ring-slate-200', label: 'Planned' },
    'in progress': { cls: 'bg-sky-100 text-sky-700 ring-sky-200', label: 'In Progress' },
    'completed': { cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200', label: 'Completed' },
    'canceled': { cls: 'bg-rose-100 text-rose-700 ring-rose-200', label: 'Canceled' },
    'postponed': { cls: 'bg-amber-100 text-amber-800 ring-amber-200', label: 'Postponed' },
    'active': { cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200', label: 'Active' },
    'closed': { cls: 'bg-rose-100 text-rose-700 ring-rose-200', label: 'Closed' },
  }
  const m = map[v] || { cls: 'bg-slate-100 text-slate-700 ring-slate-200', label: value || '—' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ring-1 ${m.cls}`}>{m.label}</span>
}

// Health feature removed from UI per request

// (Removed ProbBar as probability is displayed as numeric text only)


export default function ClientsPage(){
  const { clients, team, addClient, updateClient, deleteClient, addActivity, currentUser, currentUserId, activities } = useStore()
  const roleLower = String(currentUser?.role || '').toLowerCase()
  const isOwner = roleLower === 'owner'
  const isAdmin = roleLower === 'admin'
  const isPrivileged = isAdmin || isOwner || roleLower === 'manager'
  const isUserLevel = roleLower === 'user' || roleLower === 'bdm'
  const canChangeOwner = roleLower === 'admin' || roleLower === 'manager'
  const [search,setSearch] = useState('')
  const [filterStatus,setFilterStatus] = useState('All')
  const [filterOwner,setFilterOwner] = useState('All')
  const [filterNewClient,setFilterNewClient] = useState('All')
  const [showDetails,setShowDetails] = useState(true)
  const [isOpen,setIsOpen] = useState(false)
  const [editing,setEditing] = useState<Client | null>(null)
  // local form mode and snapshots
  const [formMode, setFormMode] = useState<'add'|'edit'>('add')
  const [baselineForm, setBaselineForm] = useState<Partial<Client>>({})
  const [originalRecord, setOriginalRecord] = useState<Partial<Client> | null>(null)
  const [showToast, setShowToast] = useState<string | null>(null)
  const [rowEmailVisible, setRowEmailVisible] = useState<Record<string,boolean>>({})
  const [pageSize, setPageSize] = useState<number | 'All'>(10)
  // sorting state
  type SortKey = 'client'|'status'|'stage'|'owner'|'industry'|'deal'|'prob'|'country'|'activity'|'assignment'|'follow'
  const [sortBy, setSortBy] = useState<SortKey>('client')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  function toggleSort(key: SortKey){
    setSortBy(prev => {
      if(prev === key){ setSortDir(d => d==='asc'?'desc':'asc'); return prev }
      setSortDir('asc'); return key
    })
  }
  // edit selector: which client is selected for editing when in Edit mode
  const [selectedEditId, setSelectedEditId] = useState<string>('')

  // inputs with formatting
  const [dealValueInput, setDealValueInput] = useState('')
  const [probabilityInput, setProbabilityInput] = useState('')
  // Electrix offerings for Services Interested
  const SERVICE_OPTIONS = useMemo(() => [
    'Dashboards & Analytics',
    'Data Integration',
    'Apps & Platforms',
    'AI Enhancements',
    'Support & Training',
  ], [])
  // Simplified industry list (broad categories, not too detailed)
  const INDUSTRY_OPTIONS = useMemo(() => [
    'Agriculture',
    'Automotive',
    'Aerospace & Defense',
    'Chemicals',
    'Construction',
    'Consumer Goods',
    'Consulting',
    'Education',
    'Energy',
    'Financial Services',
    'Food & Beverage',
    'Government',
    'Healthcare',
    'Hospitality & Travel',
    'Insurance',
    'Legal',
    'Manufacturing',
    'Media & Entertainment',
    'Mining & Metals',
    'Non-profit',
    'Pharmaceuticals',
    'Professional Services',
    'Real Estate',
    'Retail & Ecommerce',
    'Technology',
    'Telecommunications',
    'Transportation & Logistics',
    'Utilities',
    'Other'
  ], [])
  // Backward-compatibility for previously saved long labels
  const SERVICE_RENAMES: Record<string, string> = {
    'Data Integration & ETL': 'Data Integration',
    'Apps & Platforms Development': 'Apps & Platforms',
    'Ongoing Support & Training': 'Support & Training',
  }
  const normalizeServices = (arr: unknown): string[] => {
    const list = Array.isArray(arr)
      ? (arr as string[])
      : (typeof arr === 'string' ? String(arr).split(',').map(s=>s.trim()).filter(Boolean) : [])
    const renamed = list.map(s => SERVICE_RENAMES[s] || s)
    // de-duplicate and keep only known options when possible
    const seen = new Set<string>()
    const result: string[] = []
    for(const s of renamed){
      const v = SERVICE_OPTIONS.includes(s) ? s : s
      if(!seen.has(v)) { seen.add(v); result.push(v) }
    }
    return result
  }
  const [servicesOpen, setServicesOpen] = useState(false)
  const servicesRef = React.useRef<HTMLDivElement | null>(null)

  function toggleRowEmail(id: string){
    setRowEmailVisible(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Close services dropdown when clicking outside
  React.useEffect(() => {
    if(!servicesOpen) return
    function onDocClick(e: MouseEvent){
      const el = servicesRef.current
      if(el && e.target instanceof Node && !el.contains(e.target)){
        setServicesOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [servicesOpen])

  const rows = useMemo(()=>{
    return clients.filter(c=>{
      // RLS clamp: non-privileged only see their own clients
      if(!isPrivileged && String(c.ownerId) !== String(currentUserId)) return false
      if(search){
        const s = search.toLowerCase()
        if(!(c.clientName.toLowerCase().includes(s)
          || (c.contactName||'').toLowerCase().includes(s)
          || String(c.contactEmail||'').toLowerCase().includes(s)
          || String(c.ownerEmail||'').toLowerCase().includes(s))) return false
      }
      if(filterStatus !== 'All' && String(c.status) !== String(filterStatus)) return false
      if(filterOwner !== 'All' && String(c.ownerId) !== String(filterOwner)) return false
      if(filterNewClient === 'New'){
        const thirtyDaysAgo = new Date(Date.now()-30*24*60*60*1000)
        if(!(new Date(c.createdAt || 0) > thirtyDaysAgo)) return false
      }
      return true
    })
  }, [clients, search, filterStatus, filterOwner, filterNewClient, isPrivileged, currentUserId])

  // sorted rows according to header selection
  const sortedRows = useMemo(() => {
    const copy = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    const s = (v:any) => (v==null?'':String(v)).toLowerCase()
    copy.sort((a,b) => {
      switch(sortBy){
        case 'client': return s(a.clientName).localeCompare(s(b.clientName)) * dir
        case 'status': return s(a.status).localeCompare(s(b.status)) * dir
        case 'stage': return s(a.pipelineStage).localeCompare(s(b.pipelineStage)) * dir
        case 'owner': {
          const ao = team.find(t=>String(t.id)===String(a.ownerId))?.name || ''
          const bo = team.find(t=>String(t.id)===String(b.ownerId))?.name || ''
          return s(ao).localeCompare(s(bo)) * dir
        }
        case 'industry': return s(a.industry).localeCompare(s(b.industry)) * dir
        case 'deal': return ((a.dealValue||0) - (b.dealValue||0)) * dir
        case 'prob': return ((a.probability||0) - (b.probability||0)) * dir
        case 'country': return s(a.country).localeCompare(s(b.country)) * dir
        case 'activity': return (new Date(a.lastActivityDate||0).getTime() - new Date(b.lastActivityDate||0).getTime()) * dir
        case 'assignment': {
          const aa = latestAssignmentForClient(a.id)
          const bb = latestAssignmentForClient(b.id)
          return s(aa).localeCompare(s(bb)) * dir
        }
        case 'follow': {
          const fa = latestCutoffForClient(a.id)
          const fb = latestCutoffForClient(b.id)
          const ta = fa ? new Date(fa).getTime() : -Infinity
          const tb = fb ? new Date(fb).getTime() : -Infinity
          if(ta === tb) return 0
          return (ta < tb ? -1 : 1) * dir
        }
      }
    })
    return copy
  }, [rows, sortBy, sortDir, team, activities])

  // derive visibleRows based on page size
  const visibleRows = pageSize === 'All' ? sortedRows : sortedRows.slice(0, pageSize)

  function latestAssignmentForClient(clientId: string){
    const acts = activities.filter(a=>a.clientId === clientId && a.assignment).sort((a,b)=> new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    return acts.length ? acts[0].assignment : '-'
  }

  // Latest cut-off date from Activities for a given client (most recent by datetime)
  function latestCutoffForClient(clientId: string): string | null {
    const list = activities
      .filter(a => a.clientId === clientId && !!a.cut_off_date)
      .sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    if(!list.length) return null
    const v = list[0].cut_off_date as (string | null | undefined)
    return v ? String(v) : null
  }

  const emptyForm = (): Partial<Client> => ({
  clientName: '', ownerId: currentUserId || team?.[0]?.id, ownerEmail: team?.find(t=>t.id===currentUserId)?.email || team?.[0]?.email || '', status: 'Planned', pipelineStage: 'Discovery', probability: 0, lastActivityDate: new Date().toISOString(), dealValue: 0
  })



  const [form,setForm] = useState<Partial<Client>>(emptyForm())
  const [errors,setErrors] = useState<Record<string,string>>({})
  const [openError, setOpenError] = useState<string | null>(null)
  const [activeField, setActiveField] = useState<string | null>(null)

  function openAdd(){
    const fresh = emptyForm()
    setForm(fresh)
    setBaselineForm(fresh)
    setOriginalRecord(null)
    setEditing(null)
    setFormMode('add')
    setSelectedEditId('')
    setErrors({})
    setIsOpen(true)
  }
  function openEdit(c: Client){
    // backward-compatible openEdit (keeps previous behavior)
    openEditFromRow(c)
  }

  function openEditFromRow(c: Client){
    try{
      console.debug('openEditFromRow called with client:', c)
      // merge client onto emptyForm defaults so all expected fields exist
      const merged = { ...emptyForm(), ...c }
      // normalize any legacy service labels to the current shorter ones
      if((merged as any).servicesInterested){
        (merged as any).servicesInterested = normalizeServices((merged as any).servicesInterested)
      }
      // map DB 'role' column to UI field contactRole so it shows in the form
      if(!(merged as any).contactRole && (merged as any).role){
        (merged as any).contactRole = (merged as any).role
      }
      // enforce industry to be from the predefined list; map legacy/non-listed to 'Other'
      if((merged as any).industry){
        const ind = String((merged as any).industry)
        if(!INDUSTRY_OPTIONS.includes(ind)){
          (merged as any).industry = 'Other'
        }
      }
      setForm(merged)
      setBaselineForm(merged)
      setOriginalRecord(merged)
  setEditing({ ...c } as Client)
  setSelectedEditId(String(c.id))
      setFormMode('edit')
      setErrors({})
      setOpenError(null)
      setIsOpen(true)
    }catch(err:any){
      console.error('openEditFromRow failed', err)
      setOpenError(String(err?.message || err || 'Unknown error opening editor'))
    }
  }
  function isDirty(): boolean {
    // Compare current form to baseline snapshot for current mode
    try{
      const a = JSON.stringify({ ...baselineForm })
      const b = JSON.stringify({ ...form })
      return a !== b
    }catch{
      return false
    }
  }
  function close(force = false){
    if(!force && isDirty()){
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if(!ok) return
    }
    setIsOpen(false); setEditing(null); setErrors({}); setShowToast(null)
  }

  function validate(f: Partial<Client>){
    const e: Record<string,string> = {}
    if(!f.clientName || !f.clientName.trim()) e.clientName = 'Client Name is required'
    if(!f.ownerId) e.ownerId = 'Owner is required'
    if(!f.status) e.status = 'Status is required'
    if(!f.lastActivityDate) e.lastActivityDate = 'Last Activity Date is required'
    // Newly required fields (restricted to the predefined list)
    if(!f.industry || !INDUSTRY_OPTIONS.includes(String(f.industry))) e.industry = 'Please select a valid industry'
  const services = normalizeServices((f as any).servicesInterested)
    if(!services.length) e.servicesInterested = 'Services Interested is required'
    if(!f.contactName || !String(f.contactName).trim()) e.contactName = 'Contact Name is required'
    if(!f.contactRole || !String(f.contactRole).trim()) e.contactRole = 'Contact Role is required'
    if(!f.contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(f.contactEmail))) e.contactEmail = 'Valid email is required'
    if(f.probability!=null && (f.probability<0 || f.probability>100)) e.probability = 'Probability must be 0–100'
    return e
  }

  async function save(){
    const e = validate(form)
    if(Object.keys(e).length){ setErrors(e); return }
    // ensure servicesInterested uses normalized, shorter labels
    const normalizedServices = normalizeServices((form as any).servicesInterested)
    // map UI pipelineStage to DB enum 'stage'
    const allowedStages = ['Discovery','Negotiation','Closed Won','Closed Lost'] as const
    const stageMap: Record<string,string> = {
      'Discovery': 'Discovery',
      'Qualifying': 'Discovery',
      'Proposal Sent': 'Negotiation',
      'Negotiation': 'Negotiation',
      'Contracting': 'Negotiation',
      'Live': 'Closed Won'
    }
    const stageIn = String(form.pipelineStage || '').trim()
    const stageOut = (stageMap[stageIn] || (allowedStages.includes(stageIn as any) ? stageIn : 'Discovery'))
    // map UI status to DB enum 'status'
    const allowedStatus = ['Planned','In Progress','Completed','On Hold'] as const
    const statusIn = String(form.status || '').trim()
    const statusOut = allowedStatus.includes(statusIn as any) ? statusIn : ((statusIn === 'Canceled' || statusIn === 'Postponed') ? 'On Hold' : 'Planned')
    // derive owner name for DB 'owner' column when present
    const ownerIdFinal = (form.ownerId || currentUserId || team?.[0]?.id) as string
    const ownerName = team.find(t=>String(t.id)===String(ownerIdFinal))?.name || (form as any).ownerName || ''
    // helpers to format dates for SQL
    const toSqlDate = (v:any) => {
      if(!v) return null
      const d = new Date(v)
      if(Number.isNaN(d.getTime())) return null
      return d.toISOString().slice(0,10)
    }
    const toSqlDateTime = (v:any) => {
      if(!v) return null
      const d = new Date(v)
      if(Number.isNaN(d.getTime())) return null
      const pad = (n:number)=>String(n).padStart(2,'0')
      const yyyy = d.getFullYear()
      const mm = pad(d.getMonth()+1)
      const dd = pad(d.getDate())
      const hh = pad(d.getHours())
      const mi = pad(d.getMinutes())
      const ss = pad(d.getSeconds())
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
    }

    const payload: any = {
      ...form,
      servicesInterested: normalizedServices,
      // map UI contactRole to DB column 'role'
      role: (form as any).contactRole || (form as any).role,
      // ensure totalMonths is sent in camelCase (server maps to total_months)
      totalMonths: form.totalMonths,
      ownerId: ownerIdFinal,
      owner: ownerName,
      ownerEmail: form.ownerEmail || team.find(t=>t.id === (form.ownerId || currentUserId || team?.[0]?.id))?.email || '',
      status: statusOut,
      stage: stageOut,
      lastActivityDate: form.lastActivityDate || new Date().toISOString(),
      // DB-friendly duplicates (snake_case) to satisfy strict schemas
      client_name: form.clientName,
      legal_name: form.legalName,
      industry: form.industry,
      country: form.country,
  owner_email: (form.ownerEmail || team.find(t=>t.id === ownerIdFinal)?.email || ''),
      probability: form.probability != null ? Number(form.probability) : null,
      deal_value: form.dealValue != null ? Number(form.dealValue) : null,
      services_interested: normalizedServices.join(', '),
      contact_name: form.contactName,
      contact_email: form.contactEmail,
      // next_followup will be overridden below (edit mode) to mirror latest Activity cut-off
      next_followup: toSqlDate(form.nextFollowUpDate),
      last_activity_date: toSqlDate(form.lastActivityDate || new Date().toISOString()),
      next_meeting_datetime: toSqlDateTime(form.nextMeetingDateTime),
      total_months: form.totalMonths != null ? Number(form.totalMonths) : null,
    }
    try{
      const formAny = form as any
      if(formMode === 'edit'){
        const idToUpdateRaw = (selectedEditId || (editing && editing.id) || (formAny && formAny.id)) as string | undefined
        const idToUpdate = idToUpdateRaw ? String(idToUpdateRaw) : undefined
        if(!idToUpdate){ setErrors({ general: 'No record selected to edit.' }); return }
        // Ensure DB next_followup mirrors the latest Activity cut-off for this client
        try{
          const latestCut = latestCutoffForClient(idToUpdate)
          if(latestCut){
            const cutDateOnly = new Date(latestCut).toISOString().slice(0,10)
            payload.next_followup = cutDateOnly
            payload.nextFollowUpDate = latestCut
          } else {
            payload.next_followup = null
            payload.nextFollowUpDate = null
          }
        }catch(_){ /* ignore */ }
        const updated = await updateClient(String(idToUpdate), payload as Partial<Client>)
        // if an assignment was set, create an activity for it
        if(updated && formAny && (formAny.assignment || formAny.nextMeetingDateTime)){
          try{
            await addActivity({ type: 'Task', title: formAny.assignment || 'Follow-up', notes: '', clientId: updated.id, ownerId: formAny.ownerId || updated.ownerId, datetime: formAny.nextMeetingDateTime || new Date().toISOString(), status: 'Planned' })
          }catch(e){}
        }
        if(updated){
          setShowToast('Client updated')
          setTimeout(()=> close(true), 700)
        } else {
          setOpenError('Update did not return a row. Please verify the client ID exists and try again.')
        }
      } else {
        const created = await addClient(payload as any)
        if(created){
          setShowToast('Client created')
          setTimeout(()=> close(true), 700)
        } else {
          setOpenError('Create did not return a row. Please try again.')
        }
      }
    }catch(err:any){
      console.error('Save failed', err)
      setOpenError(String(err?.message || err || 'Save failed'))
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && console && console.debug) console.debug('form state at render:', form)
  }, [form])

  // Sync formatted numeric inputs when modal opens or values change
  useEffect(() => {
    if(!isOpen) return
    const dv = Math.max(0, Number(form.dealValue || 0))
    setDealValueInput(dv ? new Intl.NumberFormat('en-US').format(dv) : '') // plain while editing
    const pr = form.probability
    if(pr == null || Number.isNaN(Number(pr))) setProbabilityInput('')
    else setProbabilityInput(String(Math.max(0, Math.min(100, Number(pr)))))
  }, [isOpen, form.dealValue, form.probability])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Clients</h1>
        <div className="flex items-center justify-between gap-4 mt-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 bg-white/70 backdrop-blur border rounded-xl px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 bg-white border rounded px-3 py-1">
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients by name or email…" className="text-sm outline-none w-72" />
              </div>
              <select className="text-sm border rounded px-2 py-1" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                <option value="All">Status</option>
                <option>Planned</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Canceled</option>
                <option>Postponed</option>
              </select>
              <select className="text-sm border rounded px-2 py-1" value={filterOwner} onChange={e=>setFilterOwner(e.target.value)}>
                {isPrivileged ? <option value="All">{isOwner ? 'Assigned' : 'Team'}</option> : null}
                {(() => {
                  const adminTeamLower = String((currentUser as any)?.team || '').toLowerCase()
                  let options = team
                  if(isAdmin){
                    if(adminTeamLower.includes('all market')){
                      options = team.filter(t => String((t as any).role||'').toLowerCase() !== 'owner')
                    } else {
                      options = team.filter(t => {
                        const r = String((t as any).role||'').toLowerCase()
                        const sameTeam = String((t as any).team||'').toLowerCase() === adminTeamLower
                        const isUserLevel = r === 'user' || r === 'bdm'
                        const isSelf = String(t.id) === String(currentUserId)
                        return isSelf || (isUserLevel && sameTeam)
                      })
                    }
                  } else if(!isOwner) {
                    options = team.filter(t => String(t.id) === String(currentUserId))
                  }
                  return options.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                })()}
              </select>
              <select className="text-sm border rounded px-2 py-1" value={filterNewClient} onChange={e=>setFilterNewClient(e.target.value)}>
                <option value="All">New Client</option>
                <option value="New">New (30d)</option>
              </select>
              <button
                type="button"
                onClick={()=>{ setSearch(''); setFilterStatus('All'); setFilterOwner('All'); setFilterNewClient('All') }}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 ml-1"
                title="Reset filters"
                aria-label="Reset filters"
              >
                <span>Reset</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={()=>setShowDetails(s=>!s)}>
              {showDetails ? 'Hide details' : 'Show details'}
            </Button>
            <button
              onClick={openAdd}
              type="button"
              aria-label="Add Client"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] shadow-[0_6px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.45),0_0_12px_rgba(139,92,246,0.35)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#8B5CF6]/40"
            >
              <Plus size={16} className="opacity-95" />
              Add Client
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <table className={`w-full table-auto ${showDetails ? 'text-xs' : ''}`}>
          <thead className="bg-slate-50">
            <tr className={`text-left ${showDetails ? 'text-[11px] text-slate-600 font-semibold tracking-wide uppercase' : 'text-sm text-slate-600 font-semibold tracking-wide uppercase'}`}>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('client')}>Client {sortBy==='client' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('status')}>Status {sortBy==='status' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('stage')}>Stage {sortBy==='stage' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              {showDetails ? (
                <>
                  <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('owner')}>Owner {sortBy==='owner' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('industry')}>Industry {sortBy==='industry' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  <th className="px-2 py-2 border-b border-slate-200 text-right"><button className="hover:text-slate-900" onClick={()=>toggleSort('deal')}>Deal {sortBy==='deal' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  <th className="px-2 py-2 border-b border-slate-200 text-right"><button className="hover:text-slate-900" onClick={()=>toggleSort('prob')}>Prob {sortBy==='prob' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  <th className="px-2 py-2 border-b border-slate-200">Contact</th>
                  <th className="px-2 py-2 border-b border-slate-200" style={{ minWidth: 160 }}>Email</th>
                  <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('country')}>Country {sortBy==='country' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('activity')}>Activity {sortBy==='activity' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('assignment')}>Assignment {sortBy==='assignment' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('follow')}>Follow {sortBy==='follow' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
                  {/* Health column removed */}
                  <th className="px-2 py-2 border-b border-slate-200"></th>
                </>
              ) : (
                <th className="px-2 py-2 border-b border-slate-200">Owner Email</th>
              )}
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 ${showDetails ? 'text-xs' : ''}`}>
            {/* inline edit row */}
            {editing && !isOpen && (
              <tr className="bg-yellow-50">
                <td className="px-2 py-2" colSpan={showDetails ? 13 : 4}>
                  <div className="p-3 bg-white border rounded">
                    <div className="flex gap-3 items-center">
                      <input className="border p-2 rounded w-64" value={form.clientName||''} onChange={e=>setForm({...form, clientName: e.target.value})} />
                      <input className="border p-2 rounded w-48" value={form.contactName||''} onChange={e=>setForm({...form, contactName: e.target.value})} />
                      <input type="date" className="border p-2 rounded" value={toDateInputValue(form.lastActivityDate as string | null)} onChange={e=>setForm({...form, lastActivityDate: e.target.value? new Date(e.target.value).toISOString(): ''})} />
                      <div className="ml-auto flex gap-2">
                        <button className="px-3 py-2 bg-slate-100 rounded" onClick={()=>{ setEditing(null); setForm(emptyForm()); setErrors({}) }}>Cancel</button>
                        <button className="px-3 py-2 bg-amber-500 text-white rounded" onClick={()=>save()}>Save</button>
                      </div>
                    </div>
                    {openError && <div className="text-red-600 mt-2">{openError}</div>}
                  </div>
                </td>
              </tr>
            )}
            {visibleRows.map(c=> (
              <tr key={c.id} className={`${showDetails ? 'align-top' : 'border-b'} hover:bg-slate-50 transition-colors`}>
                <td className={`px-2 ${showDetails ? 'py-1' : 'py-3'}`}>{c.clientName}{showDetails && <div className="text-[10px] text-slate-400">{c.legalName}</div>}</td>
                <td className={`px-2 ${showDetails ? 'py-1' : 'py-3'}`}><StatusBadge value={c.status} /></td>
                <td className={`px-2 ${showDetails ? 'py-1' : 'py-3'}`}>{c.pipelineStage}</td>
                {showDetails ? (
                  <>
                    <td className="px-2 py-1">{
                      (() => {
                        const byId = team.find(t=>String(t.id)===String(c.ownerId))
                        if(byId) return byId.name
                        const email = (c as any).ownerEmail
                        if(email){
                          const byEmail = team.find(t => String(t.email||'').toLowerCase() === String(email).toLowerCase())
                          if(byEmail) return byEmail.name
                        }
                        return (c as any).ownerName || '—'
                      })()
                    }</td>
                    <td className="px-2 py-1">{c.industry}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{c.dealValue != null && c.dealValue > 0 ? `$${Number(c.dealValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{(c.probability ?? null) !== null ? `${Math.max(0, Math.min(100, Number(c.probability||0)))}%` : '-'}</td>
                    <td className="px-2 py-1 text-xs">{c.contactName ?? '-'}</td>
                    <td className="px-2 py-1 text-xs text-slate-400 align-top">
                      {/* per-row show/hide button and truncation, aligned on the same line as other cells */}
                      <div className="flex items-start gap-2 min-w-0">
                        {(() => {
                          const visible = !!rowEmailVisible[c.id]
                          const permitted = currentUser?.role === 'Admin' || currentUser?.role === 'Owner' || currentUserId === c.ownerId
                          const email = c.contactEmail ?? ''
                          if(!email) return <span className="flex-1 leading-normal">-</span>
                          if(visible && permitted){
                            return <span className="flex-1 truncate leading-normal">{email}</span>
                          }
                          // hidden or not permitted -> show masked
                          return <span className="flex-1 truncate text-slate-400 leading-normal">{maskEmail(email)}</span>
                        })()}
                        <button
                          className="inline-flex items-center justify-center w-5 h-5 text-slate-600 hover:text-slate-800 shrink-0"
                          onClick={()=>toggleRowEmail(c.id)}
                          aria-label={rowEmailVisible[c.id] ? 'Hide email' : 'Show email'}
                          title={rowEmailVisible[c.id] ? 'Hide email' : 'Show email'}
                        >
                          {rowEmailVisible[c.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-1">{c.country || '-'}</td>
                    <td className="px-2 py-1">{formatDate(c.lastActivityDate)}</td>
                    <td className="px-2 py-1">{latestAssignmentForClient(c.id)}</td>
                    <td className="px-2 py-1">{formatDate(latestCutoffForClient(c.id) ?? null)}</td>
                    {/* Health cell removed */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      <button className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-amber-50 text-amber-600 mr-1" title="Edit Client" aria-label="Edit Client" onClick={(e)=>{ e.stopPropagation(); openEditFromRow(c) }}>
                        <Pencil size={16} />
                      </button>
                      {isPrivileged && (
                        <button className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-rose-50 text-rose-600" title="Delete Client" aria-label="Delete Client" onClick={(e)=>{ e.stopPropagation(); if(confirm(`Delete ${c.clientName}?`)) deleteClient(c.id) }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </>
                ) : (
                  <td className="px-2 py-3 text-sm text-slate-700">{(c.ownerEmail ?? team.find(t=>t.id===c.ownerId)?.email) || '-'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2">
          <div className="w-full flex items-center justify-between">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <img src={Logo} alt="ELECTRIX" className="w-4 h-4 opacity-70" />
              <span>ELECTRIX</span>
              <span className="opacity-70">v0.1</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Show</span>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={String(pageSize)}
                onChange={e=>{
                  const v = e.target.value
                  setPageSize(v === 'All' ? 'All' : Number(v))
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value="All">All</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-2 md:p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { /* only close when user clicks the backdrop itself, not child elements */
              if ((e.target as HTMLElement) === (e.currentTarget as HTMLElement)) close()
            }}
          />

          <div className="relative z-50 w-full max-w-3xl mx-2 md:mx-4 max-h-[90vh]">
            <div className="bg-gradient-to-br from-white/95 to-slate-50/95 rounded-2xl shadow-2xl ring-1 ring-slate-200 p-4 md:p-6 transform-gpu overflow-hidden" style={{ boxShadow: '0 12px 30px rgba(2,6,23,0.25), inset 0 1px 0 rgba(255,255,255,0.6)' }}>
              {openError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">Error opening editor: {openError}</div>
              )}
              {showToast && (
                <div className="mb-3 p-2.5 text-sm rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 inline-flex items-center gap-2">
                  <span>{showToast}</span>
                </div>
              )}
              <div className="flex items-start justify-between mb-4 md:mb-5">
                <div>
                  <h3 className="text-2xl font-semibold">{formMode === 'edit' ? 'Edit Client' : 'Add Client'}</h3>
                  {editing && (
                    <div className="text-sm text-slate-500 mt-1">Editing: <strong>{form.clientName}</strong> — Owner: {team.find(t=>t.id===form.ownerId)?.name || '-'} — Last activity: {formatDate(form.lastActivityDate as string)}{(form as any).assignment ? ` — Assignment: ${(form as any).assignment}` : ''}</div>
                  )}
                  {activeField && <div className="text-xs text-slate-400 mt-1">Editing field: <span className="font-medium">{activeField}</span></div>}
                </div>
                <div className="flex items-center gap-3">
                  <button className="text-sm text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100" onClick={() => close()}>Cancel</button>
                  <Button onClick={save}>Save</Button>
                </div>
              </div>
              <div className="mb-3 flex flex-col md:flex-row md:items-center md:gap-3">
                <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if(formMode !== 'add'){
                        const fresh = emptyForm()
                        setForm(fresh)
                        setBaselineForm(fresh)
                        setFormMode('add')
                        setSelectedEditId('')
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formMode==='add' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow' : 'text-slate-700 hover:bg-slate-100'}`}
                    aria-pressed={formMode==='add'}
                  >Add New</button>
                  <button
                    type="button"
                    onClick={() => {
                      if(formMode !== 'edit'){
                        const base = originalRecord ? { ...originalRecord } : { ...baselineForm }
                        setForm(base)
                        setBaselineForm(base)
                        setFormMode('edit')
                        // if no client chosen yet in this session, default to first in filtered list
                        if(!selectedEditId && clients.length){
                          const first = clients[0]
                          setSelectedEditId(String(first.id))
                          openEditFromRow(first as any)
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formMode==='edit' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow' : 'text-slate-700 hover:bg-slate-100'}`}
                    aria-pressed={formMode==='edit'}
                  >Edit</button>
                </div>
                {formMode === 'edit' && (
                  <div className="mt-2 md:mt-0 md:flex md:items-center md:gap-2 w-full">
                    <span className="text-xs text-slate-500 md:whitespace-nowrap">Select client to edit</span>
                    <select
                      className="border p-2 rounded-lg text-sm bg-white md:min-w-[16rem] flex-1"
                      value={selectedEditId}
                      onChange={(e)=>{
                        const id = e.target.value
                        setSelectedEditId(id)
                        const target = clients.find(cl => String(cl.id) === String(id))
                        if(target){
                          // ensure the form carries the db id reference for display and updates
                          setForm(prev => ({ ...prev, id: String(target.id) } as any))
                          openEditFromRow(target)
                        }
                      }}
                    >
                      <option value="" disabled>Select…</option>
                      {clients.map(cl => (
                        <option key={cl.id} value={cl.id}>{cl.clientName} — {team.find(t=>String(t.id)===String(cl.ownerId))?.name || '—'}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="overflow-y-auto pr-1 md:pr-2" style={{ maxHeight: 'calc(90vh - 110px)' }}>
              <form onSubmit={e=>{ e.preventDefault(); save() }} className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3">
                {/* Section: Client Info */}
                <div className="md:col-span-3 mt-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Client Info{formMode==='edit' ? ` ${selectedEditId || (editing && editing.id) || (form as any)?.id ? (selectedEditId || (editing && editing.id) || (form as any)?.id) : ''}` : ''}
                  </div>
                  <div className="h-px bg-slate-200 mt-2" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Client Name*</label>
                  <input required onFocus={()=>setActiveField('Client Name')} onBlur={()=>setActiveField(null)} className="w-full border p-2.5 rounded-lg text-sm shadow-sm" placeholder="Client Name" value={form.clientName||''} onChange={e=>setForm({...form, clientName: e.target.value})} />
                  {errors.clientName && <div className="text-red-600 text-sm mt-1">{errors.clientName}</div>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Legal Name</label>
                  <input onFocus={()=>setActiveField('Legal Name')} onBlur={()=>setActiveField(null)} className="w-full border p-2.5 rounded-lg text-sm shadow-sm" placeholder="Legal Name" value={form.legalName||''} onChange={e=>setForm({...form, legalName: e.target.value})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Industry*</label>
                  <select
                    required
                    onFocus={()=>setActiveField('Industry')}
                    onBlur={()=>setActiveField(null)}
                    className="w-full border p-2.5 rounded-lg text-sm shadow-sm bg-white"
                    value={form.industry || ''}
                    onChange={e=>setForm({...form, industry: e.target.value})}
                  >
                    <option value="" disabled>Select industry</option>
                    {INDUSTRY_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.industry && <div className="text-red-600 text-sm mt-1">{errors.industry}</div>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Country</label>
                  <input onFocus={()=>setActiveField('Country')} onBlur={()=>setActiveField(null)} list="country-list" className="w-full border p-2.5 rounded-lg text-sm shadow-sm" placeholder="Country" value={form.country||''} onChange={e=>setForm({...form, country: (e.target.value||'').replace(/[\\/]/g,'-')})} />
                </div>

                {/* Moved from Meta: Total months of Commitment */}
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Total months of Commitment</label>
                  <input type="number" min={0} className="w-full border p-2.5 rounded-lg text-sm" placeholder="12" value={form.totalMonths ?? ''} onChange={e=>setForm({...form, totalMonths: e.target.value ? Number(e.target.value) : undefined})} />
                </div>

                {/* Owner (meta) - only show for Admin/Manager to save space */}
                {canChangeOwner && (
                  <div className="md:col-span-1">
                    <label className="block text-sm text-slate-600 mb-2">Owner</label>
                    {/* only management (Manager or Admin) can change owner; others see their own as fixed */}
                    <select onFocus={()=>setActiveField('Owner')} onBlur={()=>setActiveField(null)} className="w-full border p-2.5 rounded-lg text-sm" value={form.ownerId||''} onChange={e=>setForm({...form, ownerId: e.target.value})} disabled={!canChangeOwner}>
                      {team.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {errors.ownerId && <div className="text-red-600 text-sm mt-1">{errors.ownerId}</div>}
                  </div>
                )}

                {/* Section: Engagement Info */}
                <div className="md:col-span-3 mt-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Engagement Info</div>
                  <div className="h-px bg-slate-200 mt-1" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Stage</label>
                  <select
                    onFocus={()=>setActiveField('Stage')}
                    onBlur={()=>setActiveField(null)}
                    className={`w-full border p-2.5 rounded-lg text-sm ${isUserLevel ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : ''}`}
                    value={form.pipelineStage||'Discovery'}
                    onChange={e=>setForm({...form, pipelineStage: e.target.value as any})}
                    disabled={isUserLevel}
                  >
                    <option>Discovery</option>
                    <option>Qualifying</option>
                    <option>Proposal Sent</option>
                    <option>Negotiation</option>
                    <option>Contracting</option>
                    <option>Live</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Status</label>
                  <select onFocus={()=>setActiveField('Status')} onBlur={()=>setActiveField(null)} className="w-full border p-2.5 rounded-lg text-sm" value={form.status||'Planned'} onChange={e=>setForm({...form, status: e.target.value as any})}>
                    <option>Planned</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>Canceled</option>
                    <option>Postponed</option>
                  </select>
                </div>
                {/* Services Interested multi-select (placed next to Stage & Status) */}
                <div className="md:col-span-1" ref={servicesRef}>
                  <label className="block text-sm text-slate-600 mb-2">Services Interested*</label>
                  <div className="relative">
                    <button
                      type="button"
                      className="w-full border p-2.5 rounded-lg text-sm text-left bg-white flex items-center justify-between"
                      onClick={()=>setServicesOpen(o=>!o)}
                      aria-haspopup="listbox"
                      aria-expanded={servicesOpen}
                    >
                      <span className="truncate">
                        {(Array.isArray(form.servicesInterested) && form.servicesInterested.length)
                          ? form.servicesInterested.join(', ')
                          : 'Select services'}
                      </span>
                      <svg className={`w-4 h-4 text-slate-500 transition-transform ${servicesOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                    </button>
                    {servicesOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg p-1.5 max-h-56 overflow-auto text-sm">
                        {SERVICE_OPTIONS.map(opt => {
                          const selected = Array.isArray(form.servicesInterested) && form.servicesInterested.includes(opt)
                          return (
                            <label key={opt} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}> 
                              <input
                                type="checkbox"
                                className="accent-indigo-600 w-3.5 h-3.5"
                                checked={selected}
                                onChange={() => {
                                  const current = Array.isArray(form.servicesInterested) ? [...form.servicesInterested] : []
                                  if(selected){
                                    setForm({...form, servicesInterested: current.filter(v => v !== opt)})
                                  } else {
                                    setForm({...form, servicesInterested: [...current, opt]})
                                  }
                                }}
                              />
                              <span className="leading-tight">{opt}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {errors.servicesInterested && <div className="text-red-600 text-sm mt-1">{errors.servicesInterested}</div>}
                </div>

                {canChangeOwner && (
                  <div className="md:col-span-1">
                    <label className="block text-sm text-slate-600 mb-2">Owner Email</label>
                    {/* editable only by management */}
                    <input onFocus={()=>setActiveField('Owner Email')} onBlur={()=>setActiveField(null)} className="w-full border p-2.5 rounded-lg text-sm" placeholder="owner@company.com" value={form.ownerEmail||''} onChange={e=>setForm({...form, ownerEmail: e.target.value})} disabled={!canChangeOwner} />
                  </div>
                )}

                {/* Business row */}
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Deal Value</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full border p-2.5 rounded-lg text-sm tabular-nums"
                    placeholder="e.g., $25,000"
                    value={dealValueInput}
                    onChange={(e)=>{
                      const raw = e.target.value.replace(/[^0-9]/g,'')
                      if(!raw){ setDealValueInput(''); setForm({...form, dealValue: 0}); return }
                      const num = Math.max(0, Number(raw))
                      const disp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num)
                      setDealValueInput(disp)
                      setForm({...form, dealValue: num})
                    }}
                    onBlur={()=>{
                      // ensure display sync on blur
                      const num = Math.max(0, Number(form.dealValue||0))
                      setDealValueInput(num ? `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num)}` : '')
                    }}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Probability</label>
                  <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full border p-2.5 rounded-lg text-sm tabular-nums"
                    placeholder="0 - 100%"
                    value={probabilityInput}
                    onChange={(e)=>{
                      const raw = e.target.value.replace(/[^0-9]/g,'')
                      const num = Math.max(0, Math.min(100, Number(raw || 0)))
                      setProbabilityInput(raw)
                      setForm({...form, probability: num})
                    }}
                    onBlur={()=>{
                      const num = Math.max(0, Math.min(100, Number(form.probability||0)))
                      setProbabilityInput(String(num))
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                  </div>
                </div>

                {/* Section: Contacts */}
                <div className="md:col-span-3 mt-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Contacts</div>
                  <div className="h-px bg-slate-200 mt-1" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Contact Name*</label>
                  <input required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Contact Name" value={form.contactName||''} onChange={e=>setForm({...form, contactName: e.target.value})} />
                  {errors.contactName && <div className="text-red-600 text-sm mt-1">{errors.contactName}</div>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Role*</label>
                  <input required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Role" value={form.contactRole||''} onChange={e=>setForm({...form, contactRole: e.target.value})} />
                  {errors.contactRole && <div className="text-red-600 text-sm mt-1">{errors.contactRole}</div>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Email*</label>
                  <input required className="w-full border p-2.5 rounded-lg text-sm" placeholder="Contact Email" value={form.contactEmail||''} onChange={e=>setForm({...form, contactEmail: e.target.value})} />
                  {errors.contactEmail && <div className="text-red-600 text-sm mt-1">{errors.contactEmail}</div>}
                </div>

                {/* Section: Follow-up & Dates */}
                <div className="md:col-span-3 mt-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Follow-up & Dates</div>
                  <div className="h-px bg-slate-200 mt-1" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Next Meeting Date & Time</label>
                  <input type="datetime-local" className="w-full border p-2.5 rounded-lg text-sm" value={toDateTimeLocalValue(form.nextMeetingDateTime as string | null)} onChange={e=>setForm({...form, nextMeetingDateTime: e.target.value? new Date(e.target.value).toISOString(): null})} />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Next Follow-up</label>
                  {/* Mirrors Activity Cut-off date (read-only to reflect activity source of truth) */}
                  {(() => {
                    const cid = String((form as any).id || selectedEditId || '')
                    const cutoff = cid ? latestCutoffForClient(cid) : null
                    return (
                      <input
                        type="date"
                        className="w-full border p-2.5 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                        value={toDateInputValue(cutoff)}
                        onChange={()=>{ /* read-only view; managed via Activities cut-off */ }}
                        disabled
                        title="This value mirrors the latest Activity Cut-off date for this client"
                      />
                    )
                  })()}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Last Activity Date*</label>
                  <input type="date" className="w-full border p-2.5 rounded-lg text-sm" value={toDateInputValue(form.lastActivityDate as string | null)} onChange={e=>setForm({...form, lastActivityDate: e.target.value? new Date(e.target.value).toISOString(): ''})} />
                  {errors.lastActivityDate && <div className="text-red-600 text-sm mt-1">{errors.lastActivityDate}</div>}
                </div>

                {/* Meta and Health removed */}

                {/* Assignment hidden (managed from Activities page) */}

                {/* Notes removed per request */}

              </form>
              </div>
              
              

              <datalist id="country-list">
                <option>Afghanistan</option>
                <option>Albania</option>
                <option>Algeria</option>
                <option>Andorra</option>
                <option>Angola</option>
                <option>Antigua and Barbuda</option>
                <option>Argentina</option>
                <option>Armenia</option>
                <option>Australia</option>
                <option>Austria</option>
                <option>Azerbaijan</option>
                <option>Bahamas</option>
                <option>Bahrain</option>
                <option>Bangladesh</option>
                <option>Barbados</option>
                <option>Belarus</option>
                <option>Belgium</option>
                <option>Belize</option>
                <option>Benin</option>
                <option>Bhutan</option>
                <option>Bolivia</option>
                <option>Bosnia and Herzegovina</option>
                <option>Botswana</option>
                <option>Brazil</option>
                <option>Brunei</option>
                <option>Bulgaria</option>
                <option>Burkina Faso</option>
                <option>Burundi</option>
                <option>Cabo Verde</option>
                <option>Cambodia</option>
                <option>Cameroon</option>
                <option>Canada</option>
                <option>Central African Republic</option>
                <option>Chad</option>
                <option>Chile</option>
                <option>China</option>
                <option>Colombia</option>
                <option>Comoros</option>
                <option>Congo (Republic)</option>
                <option>Congo (Democratic Republic)</option>
                <option>Costa Rica</option>
                <option>Côte d'Ivoire</option>
                <option>Croatia</option>
                <option>Cuba</option>
                <option>Cyprus</option>
                <option>Czechia</option>
                <option>Denmark</option>
                <option>Djibouti</option>
                <option>Dominica</option>
                <option>Dominican Republic</option>
                <option>Ecuador</option>
                <option>Egypt</option>
                <option>El Salvador</option>
                <option>Equatorial Guinea</option>
                <option>Eritrea</option>
                <option>Estonia</option>
                <option>Eswatini</option>
                <option>Ethiopia</option>
                <option>Fiji</option>
                <option>Finland</option>
                <option>France</option>
                <option>Gabon</option>
                <option>Gambia</option>
                <option>Georgia</option>
                <option>Germany</option>
                <option>Ghana</option>
                <option>Greece</option>
                <option>Grenada</option>
                <option>Guatemala</option>
                <option>Guinea</option>
                <option>Guinea-Bissau</option>
                <option>Guyana</option>
                <option>Haiti</option>
                <option>Honduras</option>
                <option>Hungary</option>
                <option>Iceland</option>
                <option>India</option>
                <option>Indonesia</option>
                <option>Iran</option>
                <option>Iraq</option>
                <option>Ireland</option>
                <option>Israel</option>
                <option>Italy</option>
                <option>Jamaica</option>
                <option>Japan</option>
                <option>Jordan</option>
                <option>Kazakhstan</option>
                <option>Kenya</option>
                <option>Kiribati</option>
                <option>Korea, North</option>
                <option>Korea, South</option>
                <option>Kuwait</option>
                <option>Kyrgyzstan</option>
                <option>Laos</option>
                <option>Latvia</option>
                <option>Lebanon</option>
                <option>Lesotho</option>
                <option>Liberia</option>
                <option>Libya</option>
                <option>Liechtenstein</option>
                <option>Lithuania</option>
                <option>Luxembourg</option>
                <option>Madagascar</option>
                <option>Malawi</option>
                <option>Malaysia</option>
                <option>Maldives</option>
                <option>Mali</option>
                <option>Malta</option>
                <option>Marshall Islands</option>
                <option>Mauritania</option>
                <option>Mauritius</option>
                <option>Mexico</option>
                <option>Micronesia</option>
                <option>Moldova</option>
                <option>Monaco</option>
                <option>Mongolia</option>
                <option>Montenegro</option>
                <option>Morocco</option>
                <option>Mozambique</option>
                <option>Myanmar</option>
                <option>Namibia</option>
                <option>Nauru</option>
                <option>Nepal</option>
                <option>Netherlands</option>
                <option>New Zealand</option>
                <option>Nicaragua</option>
                <option>Niger</option>
                <option>Nigeria</option>
                <option>North Macedonia</option>
                <option>Norway</option>
                <option>Oman</option>
                <option>Pakistan</option>
                <option>Palau</option>
                <option>Panama</option>
                <option>Papua New Guinea</option>
                <option>Paraguay</option>
                <option>Peru</option>
                <option>Philippines</option>
                <option>Poland</option>
                <option>Portugal</option>
                <option>Qatar</option>
                <option>Romania</option>
                <option>Russia</option>
                <option>Rwanda</option>
                <option>Saint Kitts and Nevis</option>
                <option>Saint Lucia</option>
                <option>Saint Vincent and the Grenadines</option>
                <option>Samoa</option>
                <option>San Marino</option>
                <option>Sao Tome and Principe</option>
                <option>Saudi Arabia</option>
                <option>Senegal</option>
                <option>Serbia</option>
                <option>Seychelles</option>
                <option>Sierra Leone</option>
                <option>Singapore</option>
                <option>Slovakia</option>
                <option>Slovenia</option>
                <option>Solomon Islands</option>
                <option>Somalia</option>
                <option>South Africa</option>
                <option>South Sudan</option>
                <option>Spain</option>
                <option>Sri Lanka</option>
                <option>Sudan</option>
                <option>Suriname</option>
                <option>Sweden</option>
                <option>Switzerland</option>
                <option>Syria</option>
                <option>Taiwan</option>
                <option>Tajikistan</option>
                <option>Tanzania</option>
                <option>Thailand</option>
                <option>Timor-Leste</option>
                <option>Togo</option>
                <option>Tonga</option>
                <option>Trinidad and Tobago</option>
                <option>Tunisia</option>
                <option>Turkey</option>
                <option>Turkmenistan</option>
                <option>Tuvalu</option>
                <option>Uganda</option>
                <option>Ukraine</option>
                <option>United Arab Emirates</option>
                <option>United Kingdom</option>
                <option>United States</option>
                <option>Uruguay</option>
                <option>Uzbekistan</option>
                <option>Vanuatu</option>
                <option>Venezuela</option>
                <option>Vietnam</option>
                <option>Yemen</option>
                <option>Zambia</option>
                <option>Zimbabwe</option>
                <option>Holy See</option>
              </datalist>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
