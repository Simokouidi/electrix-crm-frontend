import React, { useState, useMemo, useRef } from 'react'
import CalendarPicker from '../components/CalendarPicker'
import { useStore } from '../lib/store'
import Button from '../components/Button'
import Logo from '../Images/Logo_copy2.png'

export default function ActivitiesPage(){
  const { activities, clients, team, addActivity, updateActivity, currentUser } = useStore()
  const roleLower = String(currentUser?.role || '').toLowerCase()
  const isPrivileged = roleLower === 'admin' || roleLower === 'owner' || roleLower === 'manager'
  const [filterOwner, setFilterOwner] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterMonth, setFilterMonth] = useState('') // YYYY-MM
  const seededRef = useRef<Record<string, true>>({})

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

  // apply header filters to clients & activities
  const filteredClients = useMemo(() => clients.filter(c => {
    if(!isPrivileged && c.ownerId !== currentUser.id) return false
    if(filterOwner && c.ownerId !== filterOwner) return false
    if(filterClient && c.id !== filterClient) return false
    return true
  }), [clients, filterOwner, filterClient, isPrivileged, currentUser.id])

  const filteredActivities = useMemo(() => activities.filter(a => {
    if(!isPrivileged && a.ownerId !== currentUser.id && !(a.clientId && filteredClients.some(c=>c.id===a.clientId))) return false
    if(filterOwner && a.ownerId !== filterOwner) return false
    if(filterClient && a.clientId && filterClient && a.clientId !== filterClient) return false
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

  // perform auto-assignments only for locally created fallback data (avoid touching server rows)
  React.useEffect(() => {
    latestActivities.forEach(a => {
      const key = a.clientId || a.id
      // Only seed once per client to avoid re-triggering on every new DB snapshot
      if(seededRef.current[String(key)]) return
      // Detect local/fallback activities by id format ('a-' prefix). Server IDs are typically numeric/DB-generated.
      const isLocalFallback = typeof a.id === 'string' && a.id.startsWith('a-')
      if(!isLocalFallback) return

      const actions = ASSIGNMENT_OPTIONS.filter(x=>x)
      if(!a.assignment || String(a.assignment).trim() === ''){
        const pick = actions.length ? actions[Math.floor(Math.random()*actions.length)] : 'Call client'
        updateActivity(a.id, { assignment: pick })
      }
      if(!a.cut_off_date){
        const dt = new Date(); dt.setDate(dt.getDate() + 3)
        const iso = dt.toISOString()
        updateActivity(a.id, { cut_off_date: iso })
      }
      seededRef.current[String(key)] = true
    })
  }, [latestActivities])

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
          <select className="border rounded p-2 text-sm" value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
            {isPrivileged ? <option value="">(any)</option> : null}
            {(isPrivileged ? team.filter(t => t.role !== 'Service') : team.filter(t => t.id === currentUser.id)).map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.role ? ` · ${m.role}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Client</label>
          <select className="border rounded p-2 text-sm" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
            {isPrivileged ? <option value="">(any)</option> : null}
            {filteredClients.map(c => (<option key={c.id} value={c.id}>{c.clientName}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Month (YYYY-MM)</label>
          <input className="border rounded p-2 text-sm" placeholder="2025-08" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </div>
        <div className="flex-1" />
      </div>
      <div className="card">
        <table className="w-full table-auto">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] text-slate-600 font-semibold tracking-wide uppercase">
              <th className="px-2 py-2 border-b border-slate-200">Type</th>
              <th className="px-2 py-2 border-b border-slate-200">Title</th>
              <th className="px-2 py-2 border-b border-slate-200">Client</th>
              <th className="px-2 py-2 border-b border-slate-200">Owner</th>
              <th className="px-2 py-2 border-b border-slate-200">Date</th>
              <th className="px-2 py-2 border-b border-slate-200">Status</th>
              <th className="px-2 py-2 border-b border-slate-200">Assignment</th>
              <th className="px-2 py-2 border-b border-slate-200">Cut-off</th>
              <th className="px-2 py-2 border-b border-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {latestActivities.map(a => {
              const pid = a.parentId || a.id
              const isEffectivelyPostponed = (a.postpones_count || 0) > 0 || a.status === 'Postponed'
              return (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 py-1">{a.type}</td>
                  <td className="px-2 py-1">{a.title}</td>
                  <td className="px-2 py-1">{clients.find(c => c.id === a.clientId)?.clientName || '-'}</td>
                  <td className="px-2 py-1">{team.find(t => t.id === a.ownerId)?.name}</td>
                  <td className="px-2 py-1">{new Date(a.datetime).toLocaleDateString()}</td>
                  <td className="px-2 py-1">
                    <select className="w-40 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" value={a.status} onChange={e => beginChange(a.id, 'status', a.status, e.target.value)}>
                      <option>Planned</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                      <option>Canceled</option>
                      <option>Postponed</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    {/* assignment: generic options only in the row; assigning to a specific person is manager/admin-only via the edit modal */}
                    <select className="w-40 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" value={a.assignment || 'Call client'} onChange={e => beginChange(a.id, 'assignment', a.assignment, e.target.value)}>
                        {ASSIGNMENT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt === '' ? '(unassigned)' : opt}</option>
                        ))}
                      </select>
                  </td>
                  <td className="px-2 py-1">
                    {isEffectivelyPostponed ? (
                      <div className="relative">
                        {/* Placeholder or formatted date + calendar icon */}
                        {!a.cut_off_date && !showDatePicker[a.id] ? (
                          <div className="cursor-pointer" onClick={() => setShowDatePicker(s => ({ ...s, [a.id]: true }))}>
                            <div className="text-amber-600 font-medium">Postponed</div>
                            <div className="text-xs text-slate-400">Pending manager cut-off</div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`${a.cut_off_date ? 'text-slate-700 font-medium' : 'text-amber-600 font-medium'}`}>{a.cut_off_date ? new Date(a.cut_off_date).toLocaleDateString() : 'Postponed'}</div>
                            {!a.cut_off_date && <div className="text-xs text-slate-400">Pending manager cut-off</div>}
                            <button aria-label={a.cut_off_date ? `Change cut-off date ${new Date(a.cut_off_date).toLocaleDateString()}` : 'Set cut-off date'} className="ml-3 px-3 py-1 text-xs border rounded bg-white flex items-center gap-2" onClick={() => {
                              const input = nativeInputs.current[a.id]
                              if(input){
                                // prefer native picker when available
                                if((input as any).showPicker) try { (input as any).showPicker(); return } catch(e){}
                                input.focus(); input.click(); return
                              }
                              setShowDatePicker(s => ({ ...s, [a.id]: true }))
                            }}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                            </button>
                          </div>
                        )}

                        {/* hidden native input to prefer browser's picker */}
                        <input ref={el => nativeInputs.current[a.id] = el} type="date" className="sr-only" value={a.cut_off_date ? String(a.cut_off_date).slice(0,10) : ''} onChange={e => {
                          const val = e.target.value // YYYY-MM-DD
                          const nextStatus = val ? (a.status === 'Postponed' ? 'Planned' : 'In Progress') : a.status
                          updateActivity(a.id, { cut_off_date: val || undefined, status: nextStatus })
                        }} />
                        {showDatePicker[a.id] && (
                          <div className="absolute z-50 mt-2">
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
                      <div className="flex items-center gap-2">
                        <div className="text-slate-700 font-medium">{a.cut_off_date ? new Date(a.cut_off_date).toLocaleDateString() : ''}</div>
                        <button aria-label={a.cut_off_date ? `Change cut-off date ${new Date(a.cut_off_date).toLocaleDateString()}` : 'Set cut-off date'} className="ml-3 px-3 py-1 text-xs border rounded bg-white flex items-center gap-2" onClick={() => {
                          const input = nativeInputs.current[a.id]
                          if(input){ if((input as any).showPicker) try { (input as any).showPicker(); return } catch(e){}; input.focus(); input.click(); return }
                          setShowDatePicker(s => ({ ...s, [a.id]: true }))
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                        </button>
                        <input ref={el => nativeInputs.current[a.id] = el} type="date" className="sr-only" value={a.cut_off_date ? String(a.cut_off_date).slice(0,10) : ''} onChange={e => {
                          const val = e.target.value // YYYY-MM-DD
                          const nextStatus = val ? (a.status === 'Postponed' ? 'Planned' : 'In Progress') : a.status
                          updateActivity(a.id, { cut_off_date: val || undefined, status: nextStatus })
                        }} />
                        {showDatePicker[a.id] && (
                          <div className="absolute z-50 mt-2">
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
                  <td className="px-2 py-1">
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
        {/* Footer brand and version, aligned with Clients table */}
        <div className="px-3 py-2">
          <div className="w-full flex items-center justify-between">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <img src={Logo} alt="ELECTRIX" className="w-4 h-4 opacity-70" />
              <span>ELECTRIX</span>
              <span className="opacity-70">v0.1</span>
            </div>
            <div />
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
                        <div className="text-xs text-slate-400">{clients.find(c=>c.id===a.clientId)?.clientName || '— No client —'} · {team.find(t=>t.id===a.ownerId)?.name}</div>
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
                      <div className="p-3 bg-slate-50 rounded text-sm">{team.find(t=>t.id===selected.ownerId)?.name}</div>
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
                    <select className="w-full border border-slate-200 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400" value={editAssignment || ''} onChange={e=>setEditAssignment(e.target.value)}>
                      {ASSIGNMENT_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt === '' ? 'Select action' : opt}</option>
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