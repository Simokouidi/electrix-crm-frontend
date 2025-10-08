import React, { useState, useMemo, useRef } from 'react'
import CalendarPicker from '../components/CalendarPicker'
import { useStore } from '../lib/store'
import Button from '../components/Button'
import Logo from '../Images/Logo_copy2.png'
// removed reset icon per request

export default function ActivitiesPage(){
  const { activities, clients, team, addActivity, updateActivity, currentUser } = useStore()
  const roleLower = String(currentUser?.role || '').toLowerCase()
  const isPrivileged = roleLower === 'admin' || roleLower === 'owner' || roleLower === 'manager'
  const isUserLevel = roleLower === 'user' || roleLower === 'bdm'
  const [filterOwner, setFilterOwner] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterMonth, setFilterMonth] = useState('') // YYYY-MM
  // Status multi-select filter (default: include all)
  const ALL_STATUSES = ['Planned','In Progress','Completed','Canceled','Postponed'] as const
  const [statusFilter, setStatusFilter] = useState<string[]>([...ALL_STATUSES])
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement | null>(null)
  const seededRef = useRef<Record<string, true>>({})

  // Sorting state for Activities table
  type SortKey = 'type'|'title'|'client'|'owner'|'date'|'status'|'assignment'|'cutoff'|'actions'
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  function toggleSort(key: SortKey){
    setSortBy(prev => {
      if(prev === key){
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return prev
      }
      setSortDir('asc')
      return key
    })
  }

  const [showDatePicker, setShowDatePicker] = useState<Record<string, boolean>>({})
  const nativeInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [showSelector,setShowSelector] = useState(false)
  const [selectedActivityId,setSelectedActivityId] = useState<string | null>(null)
  const selected = activities.find(a=>a.id === selectedActivityId) || null
  // editable fields for activity
  const [editStatus,setEditStatus] = useState<'Planned'|'In Progress'|'Completed'|'Canceled'|'Postponed'>('Planned')
  const [editNotes,setEditNotes] = useState('')
  const [editAssignment,setEditAssignment] = useState<string>('')

  // canonical assignment options (restore original list)
  const ASSIGNMENT_OPTIONS = [
    '',
    'Call client',
    'Email client',
    'Follow-up',
    'Send proposal',
    'Schedule meeting',
    'Prepare contract'
  ]

  // Load any provided icons under src/Images (svgs/pngs)
  const iconAssets = {
    ...( (import.meta as any).glob('../Images/**/*.{svg,png,jpg,jpeg}', { eager: true, import: 'default' }) as Record<string, string> ),
    ...( (import.meta as any).glob('../Image/**/*.{svg,png,jpg,jpeg}', { eager: true, import: 'default' }) as Record<string, string> ),
  }
  type IconEntry = { path: string; url: string; base: string; norm: string }
  const iconList: IconEntry[] = Object.entries(iconAssets).map(([path,url]) => {
    const base = path.split('/').pop() || path
    const baseNoExt = base.replace(/\.[a-zA-Z0-9]+$/, '')
    const norm = baseNoExt.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return { path, url, base: baseNoExt, norm }
  })
  const iconByNorm = new Map(iconList.map(e => [e.norm, e.url]))
  function normalizeName(s?: string){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g, '') }
  function findIconUrl(kind: ReturnType<typeof assignmentKindOf>, assignmentText?: string): string | null {
    // 1) Exact filename match to assignment (case/space-insensitive)
    const normAssign = normalizeName(assignmentText)
    if(normAssign && iconByNorm.has(normAssign)) return iconByNorm.get(normAssign) || null
    // 2) Keyword-based fallback
    const has = (name: string) => {
      const found = iconList.find(e => e.path.toLowerCase().includes(name) || e.base.toLowerCase().includes(name) || e.norm.includes(name.replace(/[^a-z0-9]+/g,'')))
      return found?.url || null
    }
    switch(kind){
      case 'call': return has('call') || has('phone') || has('tele')
      case 'email': return has('email') || has('mail')
      case 'meeting': return has('meeting') || has('calendar') || has('schedule') || has('meet')
      case 'proposal': return has('proposal') || has('offer')
      case 'contract': return has('contract') || has('agreement')
      case 'followup': return has('follow')
      case 'user': return has('user') || has('person')
      case 'unassigned':
        return has('unassigned') || has('none') || has('na') || has('empty') || has('default') || has('placeholder')
      case 'other':
      default: return has('task') || has('todo') || null
    }
  }

  // Map assignment text to a simplified kind
  function assignmentKindOf(val?: string): 'call'|'email'|'meeting'|'proposal'|'contract'|'followup'|'unassigned'|'user'|'other' {
    const s = String(val || '').toLowerCase().trim()
    if(!s) return 'unassigned'
    if(s.includes('call')) return 'call'
    if(s.includes('email')) return 'email'
    if(s.includes('meeting') || s.includes('schedule')) return 'meeting'
    if(s.includes('proposal')) return 'proposal'
    if(s.includes('contract')) return 'contract'
    if(s.includes('follow')) return 'followup'
    // If value looks like a team member id (exact id match), treat as user
    const isTeamId = team.some(t => String(t.id) === String(val))
    if(isTeamId) return 'user'
    return 'other'
  }

  // Provide a small icon for the Type column based on assignment kind
  function AssignmentIcon({ kind, assignment }: { kind: ReturnType<typeof assignmentKindOf>, assignment?: string }){
    const url = findIconUrl(kind, assignment)
    const svgCls = 'h-6 w-6 text-slate-700'
    const wrapCls = 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 border border-slate-200'
    if(url){
      return (
        <span className={wrapCls} aria-hidden="true">
          <img src={url} alt={assignment || kind} className="w-10 h-5" />
        </span>
      )
    }
    const common = { xmlns: 'http://www.w3.org/2000/svg', className: svgCls, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }
    return (
      <span className={wrapCls} aria-hidden="true">
        {(() => {
          switch(kind){
            case 'call':
              return (<svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.09 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.14a2 2 0 0 1 2.11-.45c.84.29 1.71.5 2.61.62A2 2 0 0 1 22 16.92z"/></svg>)
            case 'email':
              return (<svg {...common}><path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/></svg>)
            case 'meeting':
              return (<svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>)
            case 'proposal':
              return (<svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>)
            case 'contract':
              return (<svg {...common}><path d="M20 21v-8"/><path d="M16 21v-6"/><path d="M12 21v-4"/><path d="M8 21V11"/><path d="M4 21V7"/></svg>)
            case 'followup':
              return (<svg {...common}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"/><path d="M1 14l5.37 5.37A9 9 0 0 0 20.49 15"/></svg>)
            case 'user':
              return (<svg {...common}><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>)
            case 'unassigned':
            case 'other':
            default:
              return (<svg {...common}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>)
          }
        })()}
      </span>
    )
  }

  function toLocalInput(iso?: string){
    if(!iso) return ''
    const d = new Date(iso)
    // convert to local ISO-like string used by <input type="datetime-local">
    const tzOffset = d.getTimezoneOffset() * 60000
    const local = new Date(d.getTime() - tzOffset).toISOString().slice(0,16)
    return local
  }

  function openSelector(){
    setSelectedActivityId(null)
    setEditNotes('')
    setEditStatus('Planned')
  setEditAssignment('')
    setShowSelector(true)
  }

  // comment modal for mandatory notes when changing status/assignment
  const [pendingChange, setPendingChange] = useState<null | { id: string; field: 'status'|'assignment'|'both'; oldValue?: string; newValue?: string }>(null)
  const [changeNote, setChangeNote] = useState('')
  const [pendingCutoff, setPendingCutoff] = useState<string>('') // YYYY-MM-DD
  const { sendWhatsApp } = useStore()
  const { notifyStatusChange, notifyAssignment } = useStore()
  const [sending, setSending] = useState(false)
  // page size control like Clients: 10 / 20 / All
  const [pageSize, setPageSize] = useState<number | 'All'>(10)

  // Usage analytics: session + timers
  const sessionIdRef = useRef<string>('')
  const mountTsRef = useRef<number>(0)
  const flushedRef = useRef<boolean>(false)

  function genSessionId(){
    const g = (globalThis as any)
    if(g?.crypto?.randomUUID){ return g.crypto.randomUUID() as string }
    // fallback UUID v4-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  async function sendUsage(activity_type: string, activity_details?: any, time_spent_seconds?: number){
    try{
      if(!sessionIdRef.current) sessionIdRef.current = genSessionId()
      const body = {
        // Prefer currentUser.id but fall back to store's currentUser (string) or 'unknown'
        user_id: String((currentUser as any)?.id || (currentUser as any)?.ID || 'unknown'),
        activity_type,
        activity_details: activity_details ? JSON.stringify(activity_details) : undefined,
        session_id: sessionIdRef.current,
        time_spent_seconds: typeof time_spent_seconds === 'number' ? time_spent_seconds : undefined,
      }
      await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    }catch{ /* non-blocking */ }
  }

  React.useEffect(() => {
    // initialize session + mount timestamp
    if(!sessionIdRef.current) sessionIdRef.current = genSessionId()
    mountTsRef.current = Date.now()
    flushedRef.current = false
    // Emit a page-open event for immediate visibility
    sendUsage('activities_page_open', { path: (typeof location !== 'undefined' ? location.pathname : '') }).catch(()=>{})

    function flush(reason: string){
      if(flushedRef.current) return
      const start = mountTsRef.current || Date.now()
      const sec = Math.max(0, Math.round((Date.now() - start) / 1000))
      flushedRef.current = true
      // Fire-and-forget
      sendUsage('activities_page_time', { reason, path: (typeof location !== 'undefined' ? location.pathname : '') }, sec)
    }

    const onPageHide = () => flush('pagehide')
    const onBeforeUnload = () => flush('beforeunload')
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      flush('unmount')
    }
  }, [])

  // Close status dropdown on outside click
  React.useEffect(() => {
    if(!statusOpen) return
    function onDocClick(e: MouseEvent){
      const el = statusRef.current
      if(el && e.target instanceof Node && !el.contains(e.target)){
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [statusOpen])

  // Helpers to resolve recipients for the pending note modal
  function roleOf(u: any){ return String(u?.role || '').toLowerCase() }
  function teamOf(u: any){ return String(u?.team || '').toLowerCase() }
  function phoneOf(u: any){ return String((u?.phone ?? (u && (u as any).Phone) ?? '')).trim() }
  function normalizePhone(p: string){ if(!p) return p; return p.startsWith('00') ? ('+' + p.slice(2)) : p }
  // Exclusions to never show in recipients preview
  const EXCLUDED_RECIPIENTS = {
    names: new Set<string>(['christopher poon']),
    phones: new Set<string>(['+85261125665'])
  }
  function isExcludedRecipient(name?: string, phone?: string){
    const nm = String(name || '').toLowerCase().trim()
    const ph = normalizePhone(String(phone || '')).trim()
    if(nm && EXCLUDED_RECIPIENTS.names.has(nm)) return true
    if(ph && EXCLUDED_RECIPIENTS.phones.has(ph)) return true
    return false
  }
  function resolveUserByIdOrName(key: string){
    if(!key) return null as any
    const byId = team.find(t => String(t.id) === String(key))
    if(byId) return byId
    const byName = team.find(t => String((t.name||'')).toLowerCase() === String(key).toLowerCase())
    return byName || null
  }
  const pendingRecipients = React.useMemo(() => {
    if(!pendingChange) return [] as { name: string; phone: string; email?: string }[]
    const act = activities.find(a => a.id === pendingChange.id)
    if(!act) return []
    const list: { name: string; phone: string; email?: string }[] = []
    if(pendingChange.field === 'assignment'){
      const ownerUser = resolveUserByIdOrName(String(act.ownerId || ''))
      const ph = normalizePhone(phoneOf(ownerUser))
      if(ph && !isExcludedRecipient(ownerUser?.name, ph)) list.push({ name: ownerUser?.name || String(act.ownerId || ''), phone: ph, email: String(ownerUser?.email || '') })
    } else {
      // status change: send to direct manager (or admin same market) + all owners
      let manager: any = null
      if(currentUser?.managerId){ manager = team.find(t => String(t.id) === String(currentUser.managerId)) || null }
      if(!manager){
        const tname = teamOf(currentUser)
        if(tname){ manager = team.find(t => roleOf(t) === 'admin' && teamOf(t) === tname) || null }
      }
      if(manager){ const ph = normalizePhone(phoneOf(manager)); if(ph && !isExcludedRecipient(manager?.name, ph)) list.push({ name: manager.name, phone: ph, email: String((manager as any)?.email || '') }) }
      team.filter(t => roleOf(t) === 'owner').forEach(o => {
        const ph = normalizePhone(phoneOf(o)); if(ph && !isExcludedRecipient(o?.name, ph)) list.push({ name: o.name, phone: ph, email: String((o as any)?.email || '') })
      })
      // de-dupe by phone
      const seen = new Set<string>()
      return list.filter(r => { const k = r.phone; if(seen.has(k)) return false; seen.add(k); return true })
    }
    return list
  }, [pendingChange, activities, team, currentUser])

  function beginChange(id: string, field: 'status'|'assignment', oldValue?: string, newValue?: string){
    setPendingChange({ id, field, oldValue, newValue })
    setChangeNote('')
    if(field === 'assignment') setPendingCutoff('')
  }

  function cancelPending(){ setPendingChange(null); setChangeNote(''); setPendingCutoff('') }

  async function confirmPending(){
    if(!pendingChange) return
    if(changeNote.trim() === '') return alert('Please leave a note explaining the change (mandatory).')
    // If changing assignment require a cut-off date selection
    if(pendingChange.field === 'assignment'){
      if(!pendingCutoff) return alert('Please select a cut-off date for the new assignment.')
    }
    const { id, field, oldValue, newValue } = pendingChange
    setSending(true)
    try{
      if(field === 'status' || field === 'both'){
  const updated = await updateActivity(id, { status: (field === 'status' ? newValue : (newValue || undefined)) as any })
  if(updated) await notifyStatusChange(updated, currentUser.id, changeNote)
  // usage: status change
  sendUsage('status_change', { activityId: id, from: oldValue, to: newValue, note: changeNote }).catch(()=>{})
      }
  if(field === 'assignment' || field === 'both'){
    // if both, we may already have updated status; now update assignment
  // build cut-off ISO from date-only input
  const cutoffDate = pendingCutoff || undefined // keep as YYYY-MM-DD for DB date columns
  const updatedAssign = await updateActivity(id, { assignment: (field === 'assignment' ? newValue : (newValue || undefined)), status: 'Planned', cut_off_date: cutoffDate })
  // resolve assignee: allow either id or name to be provided
  const candidate = (field === 'assignment' ? newValue : (newValue || '')) || ''
  let assignee = team.find(t => t.id === candidate)
  if(!assignee) assignee = team.find(t => t.name === candidate)
  const assigneeId = assignee?.id || ''
  if(updatedAssign) await notifyAssignment(updatedAssign, assigneeId || updatedAssign.ownerId, currentUser.id, changeNote)
  // usage: assignment change
  sendUsage('assignment_change', { activityId: id, from: oldValue, to: newValue, cutoff: cutoffDate, assigneeId, note: changeNote }).catch(()=>{})
  }
      alert('Change saved and notification sent.')
    }catch(err:any){
      // eslint-disable-next-line no-console
      console.error('Send failed', err)
      const msg = err?.message || String(err)
      alert('Change saved but sending notification failed: ' + msg + '\n\nCheck DevTools Console and Network tab for request/response details.')
    } finally {
      setPendingChange(null)
      setChangeNote('')
      setPendingCutoff('')
      setSending(false)
    }
  }

  function saveEdits(){
    if(!selected) return
    // if setting to Postponed, clear cutOff and set postponedBy (record current user as who postponed)
    if(editStatus === 'Postponed'){
      updateActivity(selected.id, { status: 'Postponed', notes: editNotes, assignment: editAssignment || undefined, cut_off_date: undefined })
    } else {
      updateActivity(selected.id, { status: editStatus, notes: editNotes, assignment: editAssignment || undefined })
    }
    setShowSelector(false)
  }

  // Interdependent select options: owners constrained by selected client, clients constrained by selected owner
  const ownersForSelect = useMemo(() => {
    if(filterClient){
      const cli = clients.find(c => String(c.id) === String(filterClient))
      if(cli){
        return team.filter(t => String(t.id) === String(cli.ownerId))
      }
    }
    return (isPrivileged ? team.filter(t => t.role !== 'Service') : team.filter(t => t.id === currentUser.id))
  }, [team, clients, filterClient, isPrivileged, currentUser.id])
  const clientsForSelect = useMemo(() => {
    const base = isPrivileged ? clients : clients.filter(c => c.ownerId === currentUser.id)
    if(filterOwner){
      return base.filter(c => String(c.ownerId) === String(filterOwner))
    }
    return base
  }, [clients, filterOwner, isPrivileged, currentUser.id])

  // apply header filters to clients & activities
  const filteredClients = useMemo(() => clients.filter(c => {
    if(!isPrivileged && String(c.ownerId) !== String(currentUser.id)) return false
    if(filterOwner && String(c.ownerId) !== String(filterOwner)) return false
    if(filterClient && String(c.id) !== String(filterClient)) return false
    return true
  }), [clients, filterOwner, filterClient, isPrivileged, currentUser.id])

  const filteredActivities = useMemo(() => activities.filter(a => {
    if(!isPrivileged && String(a.ownerId) !== String(currentUser.id) && !(a.clientId && filteredClients.some(c=> String(c.id)===String(a.clientId)))) return false
    // Owner filter should match the owning BDM of the client (source of truth),
    // falling back to activity.ownerId or resolved owner name when client is absent.
    if(filterOwner){
      const clientOwner = a.clientId ? clients.find(c => String(c.id) === String(a.clientId))?.ownerId : undefined
      if(clientOwner != null){
        if(String(clientOwner) !== String(filterOwner)) return false
      } else {
        const selectedOwner = team.find(t => String(t.id) === String(filterOwner))
        const byId = String(a.ownerId) === String(filterOwner)
        const byName = selectedOwner ? (ownerNameFor(a) === selectedOwner.name) : false
        if(!byId && !byName) return false
      }
    }
    if(filterClient && a.clientId && filterClient && String(a.clientId) !== String(filterClient)) return false
    if(filterMonth){
      const [y,m] = filterMonth.split('-').map(Number)
      const dt = a.cut_off_date ? new Date(a.cut_off_date) : new Date(a.datetime)
      if(!(dt.getFullYear() === y && (dt.getMonth()+1) === m)) return false
    }
    return true
  }), [activities, filterOwner, filterClient, filterMonth, isPrivileged, currentUser.id, filteredClients])

  // derive latest snapshot per clientId (show one row per client) from filteredActivities
  const latestActivities = useMemo(() => {
    const map = new Map<string, any[]>()
    filteredActivities.forEach(a => {
      const cid = a.clientId || 'unknown'
      const existing = map.get(cid) || []
      existing.push(a)
      map.set(cid, existing)
    })
    const latest: typeof activities = []
    map.forEach((arr, cid) => {
      // pick most recent snapshot by createdAt (DB) then datetime
      arr.sort((x:any,y:any) => {
        const yTime = new Date(y.createdAt || y.datetime || 0).getTime()
        const xTime = new Date(x.createdAt || x.datetime || 0).getTime()
        if(yTime !== xTime) return yTime - xTime
        return (y.version || 0) - (x.version || 0)
      })
      latest.push(arr[0])
    })
    // sort displayed rows by createdAt desc (latest first); fallback to datetime
    latest.sort((a,b) => new Date(b.createdAt || b.datetime || 0).getTime() - new Date(a.createdAt || a.datetime || 0).getTime())
    return latest
  }, [filteredActivities])

  // Apply status filter to the latest snapshot per client only
  const latestActivitiesFiltered = useMemo(() => {
    if(!statusFilter || statusFilter.length === 0){
      // No statuses selected -> show none
      return [] as typeof latestActivities
    }
    // Keep only clients whose latest status is included
    return latestActivities.filter(a => statusFilter.includes(String(a.status)))
  }, [latestActivities, statusFilter])

  // Sort according to header selection
  const sortedActivities = useMemo(() => {
    const copy = [...latestActivitiesFiltered]
    const dir = sortDir === 'asc' ? 1 : -1
    const str = (v:any) => (v==null ? '' : String(v)).toLowerCase()
    copy.sort((a,b) => {
      switch(sortBy){
        case 'type': {
          const ak = assignmentKindOf(a.assignment || '')
          const bk = assignmentKindOf(b.assignment || '')
          return str(ak).localeCompare(str(bk)) * dir
        }
        case 'title': return str(a.title).localeCompare(str(b.title)) * dir
        case 'client': {
          const an = clients.find(c=>c.id===a.clientId)?.clientName || ''
          const bn = clients.find(c=>c.id===b.clientId)?.clientName || ''
          return str(an).localeCompare(str(bn)) * dir
        }
        case 'owner': {
          const ao = ownerNameFor(a)
          const bo = ownerNameFor(b)
          return str(ao).localeCompare(str(bo)) * dir
        }
        case 'status': return str(a.status).localeCompare(str(b.status)) * dir
        case 'assignment': return str(a.assignment||'').localeCompare(str(b.assignment||'')) * dir
        case 'cutoff': {
          const ta = a.cut_off_date ? new Date(a.cut_off_date).getTime() : -Infinity
          const tb = b.cut_off_date ? new Date(b.cut_off_date).getTime() : -Infinity
          if(ta === tb) return 0
          return (ta < tb ? -1 : 1) * dir
        }
  case 'actions':
  case 'date':
        default: {
          const ta = new Date(a.datetime || a.createdAt || 0).getTime()
          const tb = new Date(b.datetime || b.createdAt || 0).getTime()
          if(ta === tb) return 0
          return (ta < tb ? -1 : 1) * dir
        }
      }
    })
    return copy
  }, [latestActivitiesFiltered, sortBy, sortDir, clients])

  // Visible rows based on page size
  const visibleActivities = useMemo(() => (
    pageSize === 'All' ? sortedActivities : sortedActivities.slice(0, pageSize)
  ), [sortedActivities, pageSize])

  // perform auto-assignments only for locally created fallback data (avoid touching server rows)
  React.useEffect(() => {
    latestActivities.forEach(a => {
      const key = a.clientId || a.id
      // Only seed once per client to avoid re-triggering on every new DB snapshot
      if(seededRef.current[String(key)]) return
      // Detect local/fallback activities by id format ('a-' prefix). Server IDs are typically numeric/DB-generated.
      const isLocalFallback = typeof a.id === 'string' && a.id.startsWith('a-')
      if(!isLocalFallback) return
      // Do NOT auto-seed assignment; keep as unassigned by default
      if(!a.cut_off_date){
        const dt = new Date(); dt.setDate(dt.getDate() + 3)
        const iso = dt.toISOString()
        updateActivity(a.id, { cut_off_date: iso })
      }
      seededRef.current[String(key)] = true
    })
  }, [latestActivities])

  // Helper: resolve an owner's display name for an activity with multiple fallbacks
  function ownerNameFor(a: { ownerId?: any; clientId?: any }){
    const raw = a?.ownerId
    const id = raw !== undefined && raw !== null ? String(raw) : ''
    // 1) Exact match by id
    const byId = team.find(t => String(t.id) === id)
    if(byId) return byId.name || String(byId.id)
    // 2) Some DB exports may put the owner NAME into ownerId; try matching by name
    if(id){
      const byName = team.find(t => String((t.name||'')).toLowerCase() === id.toLowerCase())
      if(byName) return byName.name
    }
    // 3) Fallback via the client’s owner
    const cli = clients.find(c => String(c.id) === String(a.clientId))
    if(cli){
      const byClientOwnerId = team.find(t => String(t.id) === String(cli.ownerId))
      if(byClientOwnerId) return byClientOwnerId.name || String(byClientOwnerId.id)
    }
    // 4) Last resort: show the raw value (often already a human name) or '-'
    return id || '-'
  }

  // breakdown modal state (client-level)
  const [breakdownClientId, setBreakdownClientId] = useState<string | null>(null)
  function openBreakdown(clientId: string){ setBreakdownClientId(clientId) }
  function closeBreakdown(){ setBreakdownClientId(null) }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">Activities</h1>
        <div />
      </div>
      {/* Header filters: Owner, Client, Month (YYYY-MM) */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500">Owner</label>
          <select className="border rounded p-2 text-sm" value={filterOwner} onChange={e => {
            const v = e.target.value
            setFilterOwner(v)
            // If selected client doesn't belong to this owner, clear client
            if(filterClient){
              const cli = clients.find(c => String(c.id) === String(filterClient))
              if(cli && String(cli.ownerId) !== String(v)) setFilterClient('')
            }
          }}>
            {isPrivileged ? <option value="">(any)</option> : null}
            {ownersForSelect.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Client</label>
          <select className="border rounded p-2 text-sm" value={filterClient} onChange={e => {
            const v = e.target.value
            setFilterClient(v)
            if(v){
              const cli = clients.find(c => String(c.id) === String(v))
              if(cli) setFilterOwner(String(cli.ownerId))
            }
          }}>
            {isPrivileged ? <option value="">(any)</option> : null}
            {clientsForSelect.map(c => (<option key={c.id} value={c.id}>{c.clientName}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Month (YYYY-MM)</label>
          <input className="border rounded p-2 text-sm" placeholder="2025-08" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </div>
        {/* Status multi-select filter */}
        <div className="relative" ref={statusRef}>
          <label className="block text-xs text-slate-500">Status</label>
          <button
            type="button"
            onClick={() => setStatusOpen(o=>!o)}
            className="border rounded p-2 text-sm bg-white hover:bg-slate-50 min-w-[10rem] flex items-center justify-between gap-2"
            aria-haspopup="listbox"
            aria-expanded={statusOpen}
          >
            <span className="truncate">
              {statusFilter.length === ALL_STATUSES.length
                ? 'All statuses'
                : (statusFilter.length === 0 ? 'None' : statusFilter.join(', '))}
            </span>
            <svg className={`w-4 h-4 text-slate-500 transition-transform ${statusOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
          </button>
          {statusOpen && (
            <div className="absolute z-20 mt-1 w-56 bg-white border rounded-lg shadow-lg p-1.5 max-h-60 overflow-auto">
              <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500">
                <button className="hover:text-slate-700" onClick={()=>setStatusFilter([...ALL_STATUSES])}>Select all</button>
                <button className="hover:text-slate-700" onClick={()=>setStatusFilter([])}>Clear</button>
              </div>
              {([...ALL_STATUSES] as string[]).map(st => {
                const checked = statusFilter.includes(st)
                return (
                  <label key={st} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${checked ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="accent-sky-600 w-3.5 h-3.5"
                      checked={checked}
                      onChange={() => {
                        setStatusFilter(prev => checked ? prev.filter(s => s !== st) : [...prev, st])
                      }}
                    />
                    <span className="text-sm leading-tight">{st}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-slate-500">&nbsp;</label>
          <button
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
            onClick={() => { setFilterOwner(''); setFilterClient(''); setFilterMonth(''); setStatusFilter([...ALL_STATUSES]); }}
            title="Reset filters"
            aria-label="Reset filters"
          >
            <span>Reset</span>
          </button>
        </div>
        <div className="flex-1" />
      </div>
      <div className="card">
        <table className="w-full table-auto">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] text-slate-600 font-semibold tracking-wide uppercase">
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('type')}>Type {sortBy==='type' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('title')}>Title {sortBy==='title' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('client')}>Client {sortBy==='client' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('owner')}>Owner {sortBy==='owner' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('date')}>Date {sortBy==='date' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('status')}>Status {sortBy==='status' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('assignment')}>Assignment {sortBy==='assignment' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('cutoff')}>Cut-off {sortBy==='cutoff' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
              <th className="px-2 py-2 border-b border-slate-200"><button className="hover:text-slate-900" onClick={()=>toggleSort('actions')}>Actions {sortBy==='actions' ? (sortDir==='asc'?'▲':'▼') : ''}</button></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {visibleActivities.map(a => {
              const pid = a.parentId || a.id
              const isEffectivelyPostponed = (a.postpones_count || 0) > 0 || a.status === 'Postponed'
              return (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 py-2">
                    <div className="flex items-center">
                      <AssignmentIcon kind={assignmentKindOf(a.assignment || '')} assignment={a.assignment || ''} />
                      <span className="sr-only">{String(a.assignment || '(unassigned)')}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">{a.title}</td>
                  <td className="px-2 py-2">{clients.find(c => c.id === a.clientId)?.clientName || '-'}</td>
                  <td className="px-2 py-2">{ownerNameFor(a)}</td>
                  <td className="px-2 py-2">{new Date(a.datetime).toLocaleDateString()}</td>
                  <td className="px-2 py-2">
                    <select className="w-40 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" value={a.status} onChange={e => beginChange(a.id, 'status', a.status, e.target.value)}>
                      <option>Planned</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                      <option>Canceled</option>
                      <option>Postponed</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {/* assignment: generic options only in the row; manager/admin can change; users/BDM see it disabled */}
                    <select
                      className={`w-40 border rounded px-2 py-1 text-xs focus:outline-none ${isUserLevel ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-200 focus:ring-2 focus:ring-sky-100 focus:border-sky-400'}`}
                      value={a.assignment || ''}
                      onChange={e => beginChange(a.id, 'assignment', a.assignment, e.target.value)}
                      disabled={isUserLevel}
                    >
                        {ASSIGNMENT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt === '' ? '(unassigned)' : opt}</option>
                        ))}
                      </select>
                  </td>
                  <td className="px-2 py-2">
                    {isEffectivelyPostponed ? (
                      <div className="relative">
                        {/* Placeholder or formatted date + calendar icon */}
                        {!a.cut_off_date && !showDatePicker[a.id] ? (
                          isUserLevel ? (
                            <div>
                              <div className="text-amber-600 font-medium">Postponed</div>
                              <div className="text-xs text-slate-400">Pending manager cut-off</div>
                            </div>
                          ) : (
                            <div className="cursor-pointer" onClick={() => setShowDatePicker(s => ({ ...s, [a.id]: true }))}>
                              <div className="text-amber-600 font-medium">Postponed</div>
                              <div className="text-xs text-slate-400">Pending manager cut-off</div>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`${a.cut_off_date ? (isUserLevel ? 'text-slate-400 font-medium' : 'text-slate-700 font-medium') : 'text-amber-600 font-medium'}`}>{a.cut_off_date ? new Date(a.cut_off_date).toLocaleDateString() : 'Postponed'}</div>
                            {!a.cut_off_date && <div className="text-xs text-slate-400">Pending manager cut-off</div>}
                            <button
                              aria-label={a.cut_off_date ? `Change cut-off date ${new Date(a.cut_off_date).toLocaleDateString()}` : 'Set cut-off date'}
                              className={`ml-3 px-3 py-1 text-xs border rounded flex items-center gap-2 ${isUserLevel ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white'}`}
                              disabled={isUserLevel}
                              onClick={() => {
                                if(isUserLevel) return
                                const input = nativeInputs.current[a.id]
                                if(input){
                                  // prefer native picker when available
                                  if((input as any).showPicker) try { (input as any).showPicker(); return } catch(e){}
                                  input.focus(); input.click(); return
                                }
                                setShowDatePicker(s => ({ ...s, [a.id]: true }))
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isUserLevel ? 'text-slate-400' : 'text-slate-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                            </button>
                          </div>
                        )}

                        {/* hidden native input to prefer browser's picker */}
                        <input ref={el => nativeInputs.current[a.id] = el} type="date" className="sr-only" disabled={isUserLevel} value={a.cut_off_date ? String(a.cut_off_date).slice(0,10) : ''} onChange={e => {
                          const val = e.target.value // YYYY-MM-DD
                          const nextStatus = val ? (a.status === 'Postponed' ? 'Planned' : 'In Progress') : a.status
                          updateActivity(a.id, { cut_off_date: val || undefined, status: nextStatus })
                        }} />
                        {showDatePicker[a.id] && !isUserLevel && (
                          <div className="absolute left-0 z-50 mt-2">
                            <CalendarPicker value={a.cut_off_date || null} onSelect={(iso) => {
                              const sqlDate = iso ? new Date(iso).toISOString().slice(0,10) : undefined
                              const nextStatus = iso ? (a.status === 'Postponed' ? 'Planned' : 'In Progress') : a.status
                              updateActivity(a.id, { cut_off_date: sqlDate, status: nextStatus })
                              setShowDatePicker(s => ({ ...s, [a.id]: false }))
                            }} onCancel={() => setShowDatePicker(s => ({ ...s, [a.id]: false }))} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative flex items-center gap-2">
                        <div className={`${isUserLevel ? 'text-slate-400' : 'text-slate-700'} font-medium`}>{a.cut_off_date ? new Date(a.cut_off_date).toLocaleDateString() : ''}</div>
                        <button
                          aria-label={a.cut_off_date ? `Change cut-off date ${new Date(a.cut_off_date).toLocaleDateString()}` : 'Set cut-off date'}
                          className={`ml-3 px-3 py-1 text-xs border rounded flex items-center gap-2 ${isUserLevel ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white'}`}
                          disabled={isUserLevel}
                          onClick={() => {
                            if(isUserLevel) return
                            const input = nativeInputs.current[a.id]
                            if(input){ if((input as any).showPicker) try { (input as any).showPicker(); return } catch(e){}; input.focus(); input.click(); return }
                            setShowDatePicker(s => ({ ...s, [a.id]: true }))
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isUserLevel ? 'text-slate-400' : 'text-slate-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                        </button>
                        <input ref={el => nativeInputs.current[a.id] = el} type="date" className="sr-only" disabled={isUserLevel} value={a.cut_off_date ? String(a.cut_off_date).slice(0,10) : ''} onChange={e => {
                          const val = e.target.value // YYYY-MM-DD
                          const nextStatus = val ? (a.status === 'Postponed' ? 'Planned' : 'In Progress') : a.status
                          updateActivity(a.id, { cut_off_date: val || undefined, status: nextStatus })
                        }} />
                        {showDatePicker[a.id] && !isUserLevel && (
                          <div className="absolute left-0 z-50 mt-2">
                            <CalendarPicker value={a.cut_off_date || null} onSelect={(iso) => {
                              const sqlDate = iso ? new Date(iso).toISOString().slice(0,10) : undefined
                              const nextStatus = iso ? (a.status === 'Postponed' ? 'Planned' : 'In Progress') : a.status
                              updateActivity(a.id, { cut_off_date: sqlDate, status: nextStatus })
                              setShowDatePicker(s => ({ ...s, [a.id]: false }))
                            }} onCancel={() => setShowDatePicker(s => ({ ...s, [a.id]: false }))} />
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-xs rounded bg-sky-600 text-white" onClick={() => { setSelectedActivityId(a.id); setEditStatus(a.status); setEditNotes(a.notes || ''); setEditAssignment(a.assignment || ''); setShowSelector(true) }}>Edit</button>
                      <button className="px-3 py-1 text-xs rounded bg-slate-100 text-slate-700" onClick={() => openBreakdown(a.clientId || '')}>Breakdown</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* Footer brand and version + Show selector (like Clients) */}
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

      {showSelector && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setShowSelector(false)} />

          <div className="relative z-50 max-w-lg w-full mx-4">
            <div className="bg-gradient-to-br from-white/95 to-slate-50/95 rounded-2xl shadow-2xl ring-1 ring-slate-200 p-6 transform-gpu" style={{ boxShadow: '0 12px 30px rgba(2,6,23,0.15), inset 0 1px 0 rgba(255,255,255,0.6)' }}>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold">Activities</h3>
                <div className="flex items-center gap-3">
                      <button className="text-sm text-slate-600 px-3 py-2 rounded-md hover:bg-slate-100" onClick={()=>{ setShowSelector(false); setEditAssignment('') }}>Close</button>
                </div>
              </div>

              {!selected && (
                <div>
                  <p className="text-sm text-slate-600 mb-2">Select an activity to edit</p>
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {activities.map(a => (
                      <button key={a.id} className="w-full text-left p-3 border rounded hover:bg-slate-50" onClick={()=>{ setSelectedActivityId(a.id); setEditStatus(a.status); setEditNotes(a.notes || ''); setEditAssignment(a.assignment || '') }}>
                        <div className="text-sm font-medium">{a.title}</div>
                        <div className="text-xs text-slate-400">{clients.find(c=>c.id===a.clientId)?.clientName || '— No client —'} · {ownerNameFor(a)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected && (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Title</label>
                    <div className="p-3 bg-slate-50 rounded text-sm">{selected.title}</div>
                  </div>

                    <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-600 mb-2">Client</label>
                      <div className="p-3 bg-slate-50 rounded text-sm">{clients.find(c=>c.id===selected.clientId)?.clientName || '—'}</div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-2">Owner</label>
                      <div className="p-3 bg-slate-50 rounded text-sm">{ownerNameFor(selected)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-600 mb-2">Type</label>
                      <div className="p-3 bg-slate-50 rounded text-sm">{selected.type}</div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-2">Date</label>
                        <div className="p-3 bg-slate-50 rounded text-sm">{new Date(selected.datetime).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Assignment</label>
                    {/* main assignment options remain generic for everyone */}
                    <select
                      className={`w-full border p-3 rounded-lg text-sm focus:outline-none ${isUserLevel ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-200 focus:ring-2 focus:ring-sky-100 focus:border-sky-400'}`}
                      value={editAssignment || ''}
                      onChange={e=>setEditAssignment(e.target.value)}
                      disabled={isUserLevel}
                    >
                      {ASSIGNMENT_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt === '' ? '(unassigned)' : opt}</option>
                      ))}
                    </select>
                    {/* Manager/Admin-only: a separate control to assign to a specific team member (stores id) */}
                    {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                      <div className="mt-2">
                        <label className="block text-sm text-slate-600 mb-2">Assign to team member (Manager/Admin)</label>
                        <select className="w-full border border-slate-200 p-3 rounded-lg text-sm" value={team.find(t=>t.id===editAssignment)?.id || ''} onChange={e=>setEditAssignment(e.target.value)}>
                          <option value="">(none)</option>
                          {team.filter(t => t.role !== 'Service').map(m => (
                            <option key={m.id} value={m.id}>{m.name} {m.role ? `· ${m.role}` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Status</label>
                    <select className="w-full border border-slate-200 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" value={editStatus} onChange={e=>setEditStatus(e.target.value as any)}>
                        <option>Planned</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>Canceled</option>
                        <option>Postponed</option>
                      </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Notes</label>
                    <textarea className="w-full border p-3 rounded-lg text-sm h-24" value={editNotes} onChange={e=>setEditNotes(e.target.value)} />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button className="px-3 py-2 text-sm text-slate-600 rounded-md hover:bg-slate-100" onClick={()=>{ setSelectedActivityId(null); setEditNotes(''); setEditStatus('Planned'); setEditAssignment('') }}>Back</button>
                    <Button onClick={saveEdits}>Save</Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Mandatory change note modal */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelPending} />
          <div className="relative z-50 max-w-md w-full bg-white rounded-lg p-4 shadow-lg">
            <h4 className="font-semibold mb-2">Please add a note</h4>
            <p className="text-sm text-slate-500 mb-3">A note is required when changing {pendingChange.field}.</p>
            {pendingRecipients.length > 0 && (
              <div className="mb-3 text-xs text-slate-400">
                <div className="mb-1">Will send to:</div>
                <ul className="space-y-1">
                  {pendingRecipients.map(r => (
                    <li key={r.phone} className="flex items-center gap-2">
                      <span className="text-slate-400">{r.name}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400">{r.phone}</span>
                      {r.email ? (<>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400">{r.email}</span>
                      </>) : null}
                    </li>
                  ))}
                  {/* Always CC */}
                  <li className="flex items-center gap-2">
                    <span className="text-slate-400">Simo Kouidi (CC)</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400">simo.kouidi@electrixspace.com</span>
                  </li>
                </ul>
              </div>
            )}
            {pendingChange.field === 'assignment' && (
              <div className="mb-3">
                <label className="block text-sm text-slate-600 mb-1">Cut-off date (required)</label>
                <input type="date" className="w-full border p-2 rounded" value={pendingCutoff} onChange={e=>setPendingCutoff(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">When changing assignment, status will be set to Planned and cut-off is required.</p>
              </div>
            )}
            <textarea className="w-full border p-2 rounded mb-3" value={changeNote} onChange={e=>setChangeNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-slate-100" onClick={cancelPending}>Cancel</button>
              <button className="px-3 py-1 rounded bg-sky-600 text-white" onClick={confirmPending}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown modal */}
    {breakdownClientId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setBreakdownClientId(null)} />

          <div className="relative z-50 max-w-4xl w-full mx-4">
            <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold">Activity Breakdown</h3>
                <div>
                  <button className="text-sm text-slate-600 px-3 py-2 rounded-md hover:bg-slate-100" onClick={()=>setBreakdownClientId(null)}>Close</button>
                </div>
              </div>

              <div className="overflow-auto max-h-96">
                <table className="w-full table-auto">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] text-slate-600 font-semibold tracking-wide uppercase">
                      <th className="px-2 py-2 border-b border-slate-200">Version</th>
                      <th className="px-2 py-2 border-b border-slate-200">Status</th>
                      <th className="px-2 py-2 border-b border-slate-200">Assignment</th>
                      <th className="px-2 py-2 border-b border-slate-200">Cut-off</th>
                      <th className="px-2 py-2 border-b border-slate-200">Notes</th>
                        <th className="px-2 py-2 border-b border-slate-200">Datetime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {activities
                      .filter(x => x.clientId === breakdownClientId)
                      .filter(x => {
                        if(!filterMonth) return true
                        const [y,m] = filterMonth.split('-').map(Number)
                        const dt = x.cut_off_date ? new Date(x.cut_off_date) : new Date(x.datetime)
                        return (dt.getFullYear() === y && (dt.getMonth()+1) === m)
                      })
                        .sort((a,b) => {
                          const ta = new Date(a.createdAt || a.datetime || 0).getTime()
                          const tb = new Date(b.createdAt || b.datetime || 0).getTime()
                          if(ta !== tb) return ta - tb // earliest first
                          const va = a.version ?? 0
                          const vb = b.version ?? 0
                          if(va !== vb) return va - vb
                          return new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
                        })
                      .map(x => (
                          <tr key={x.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-2 py-1">{x.version ?? 0}</td>
                            <td className="px-2 py-1">{x.status}</td>
                            <td className="px-2 py-1">{team.find(t=>t.id===x.assignment)?.name || x.assignment || '(unassigned)'}</td>
                            <td className="px-2 py-1">
                              {x.status === 'Postponed' ? (
                                <div className="flex items-center gap-2">
                                  <div className="text-sm text-amber-600">Pending manager cut-off</div>
                                </div>
                              ) : (
                                x.cut_off_date ? new Date(x.cut_off_date).toLocaleDateString() : '-'
                              )}
                            </td>
                            <td className="px-2 py-1">{x.notes}</td>
                            <td className="px-2 py-1">{new Date(x.datetime).toLocaleDateString()}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}