import React, { useMemo, useState } from 'react'
import { useStore, Client } from '../lib/store'
import Button from '../components/Button'

function formatDate(d?: string | null){
  return d ? new Date(d).toLocaleDateString() : '-'
}

function maskEmail(email?: string){
  if(!email) return '-'
  // simple mask: first letter + ****
  const first = email.trim()[0] || ''
  return first.toUpperCase() + '****'
}


export default function ClientsPage(){
  const { clients, team, addClient, updateClient, deleteClient, currentUser, currentUserId, activities } = useStore()
  const [search,setSearch] = useState('')
  const [filterStatus,setFilterStatus] = useState('All')
  const [filterOwner,setFilterOwner] = useState('All')
  const [filterNewClient,setFilterNewClient] = useState('All')
  const [showDetails,setShowDetails] = useState(true)
  const [isOpen,setIsOpen] = useState(false)
  const [editing,setEditing] = useState<Client | null>(null)
  const [rowEmailVisible, setRowEmailVisible] = useState<Record<string,boolean>>({})
  const [showAllRows, setShowAllRows] = useState(false)
  const TOP_ROWS = 5

  function toggleRowEmail(id: string){
    setRowEmailVisible(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const rows = useMemo(()=>{
    return clients.filter(c=>{
      if(search){
        const s = search.toLowerCase()
        if(!(c.clientName.toLowerCase().includes(s) || (c.contactName||'').toLowerCase().includes(s))) return false
      }
      if(filterStatus !== 'All' && c.status !== filterStatus) return false
      if(filterOwner !== 'All' && c.ownerId !== filterOwner) return false
      if(filterNewClient === 'New'){
        const thirtyDaysAgo = new Date(Date.now()-30*24*60*60*1000)
        if(!(new Date(c.createdAt || 0) > thirtyDaysAgo)) return false
      }
      return true
    })
  }, [clients, search, filterStatus, filterOwner, filterNewClient])

  // derive visibleRows based on collapse state
  const visibleRows = showAllRows ? rows : rows.slice(0, TOP_ROWS)

  function latestAssignmentForClient(clientId: string){
    const acts = activities.filter(a=>a.clientId === clientId && a.assignment).sort((a,b)=> new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    return acts.length ? acts[0].assignment : '-'
  }

  const emptyForm = (): Partial<Client> => ({
  clientName: '', ownerId: currentUserId || team?.[0]?.id, ownerEmail: team?.find(t=>t.id===currentUserId)?.email || team?.[0]?.email || '', status: 'Planned', pipelineStage: 'Discovery', probability: 0, lastActivityDate: new Date().toISOString(), dealValue: 0, healthScore: 'Green'
  })


  const [form,setForm] = useState<Partial<Client>>(emptyForm())
  const [errors,setErrors] = useState<Record<string,string>>({})

  function openAdd(){ setForm(emptyForm()); setEditing(null); setErrors({}); setIsOpen(true) }
  function openEdit(c: Client){ setForm(c); setEditing(c); setErrors({}); setIsOpen(true) }
  function close(){ setIsOpen(false); setEditing(null); setErrors({}) }

  function validate(f: Partial<Client>){
    const e: Record<string,string> = {}
    if(!f.clientName || !f.clientName.trim()) e.clientName = 'Client Name is required'
    if(!f.ownerId) e.ownerId = 'Owner is required'
    if(!f.status) e.status = 'Status is required'
    if(!f.lastActivityDate) e.lastActivityDate = 'Last Activity Date is required'
    if(f.probability!=null && (f.probability<0 || f.probability>100)) e.probability = 'Probability must be 0–100'
    if(f.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contactEmail)) e.contactEmail = 'Invalid email'
    return e
  }

  function save(){
    const e = validate(form)
    if(Object.keys(e).length){ setErrors(e); return }
    const payload: any = {
  ...form,
  ownerId: form.ownerId || currentUserId || team?.[0]?.id,
  ownerEmail: form.ownerEmail || team.find(t=>t.id === (form.ownerId || currentUserId || team?.[0]?.id))?.email || '',
  status: (form.status as any) || 'Prospect',
  lastActivityDate: form.lastActivityDate || new Date().toISOString(),
    }
    if(editing){
      const updated = updateClient(editing.id, payload as Partial<Client>)
      if(updated) close()
    } else {
      addClient(payload as any)
      close()
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Clients</h1>
        <div className="flex items-center justify-between gap-4 mt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border rounded px-3 py-1">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search" className="text-sm outline-none w-72" />
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
              <option value="All">Assigned</option>
              {team.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="text-sm border rounded px-2 py-1" value={filterNewClient} onChange={e=>setFilterNewClient(e.target.value)}>
              <option value="All">New Client</option>
              <option value="New">New (30d)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={()=>setShowDetails(s=>!s)}>
              {showDetails ? 'Hide details' : 'Show details'}
            </Button>
            <Button onClick={openAdd}>Add Client</Button>
          </div>
        </div>
      </div>

      <div className="card">
        <table className={`w-full table-auto ${showDetails ? 'text-xs' : ''}`}>
          <thead className="bg-slate-50">
            <tr className={`text-left ${showDetails ? 'text-xs text-slate-500' : 'text-sm text-slate-600'}`}>
              <th className="px-2 py-2 border-b border-slate-200">Client</th>
              <th className="px-2 py-2 border-b border-slate-200">Status</th>
              <th className="px-2 py-2 border-b border-slate-200">Stage</th>
              {showDetails ? (
                <>
                  <th className="px-2 py-2 border-b border-slate-200">Owner</th>
                  <th className="px-2 py-2 border-b border-slate-200">Industry</th>
                  <th className="px-2 py-2 border-b border-slate-200">Deal</th>
                  <th className="px-2 py-2 border-b border-slate-200">Prob</th>
                  <th className="px-2 py-2 border-b border-slate-200">Contact</th>
                  <th className="px-2 py-2 border-b border-slate-200" style={{ minWidth: 160 }}>Email</th>
                  <th className="px-2 py-2 border-b border-slate-200">Country</th>
                  <th className="px-2 py-2 border-b border-slate-200">Activity</th>
                  <th className="px-2 py-2 border-b border-slate-200">Assignment</th>
                  <th className="px-2 py-2 border-b border-slate-200">Follow-up</th>
                  <th className="px-2 py-2 border-b border-slate-200">Health</th>
                  <th className="px-2 py-2 border-b border-slate-200"></th>
                </>
              ) : (
                <th className="px-2 py-2 border-b border-slate-200">Owner Email</th>
              )}
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 ${showDetails ? 'text-xs' : ''}`}>
            {visibleRows.map(c=> (
              <tr key={c.id} className={`${showDetails ? 'align-top' : 'border-b'}`}>
                <td className={`px-2 ${showDetails ? 'py-1' : 'py-3'}`}>{c.clientName}{showDetails && <div className="text-[10px] text-slate-400">{c.legalName}</div>}</td>
                <td className={`px-2 ${showDetails ? 'py-1' : 'py-3'}`}>{c.status}</td>
                <td className={`px-2 ${showDetails ? 'py-1' : 'py-3'}`}>{c.pipelineStage}</td>
                {showDetails ? (
                  <>
                    <td className="px-2 py-1">{team.find(t=>t.id===c.ownerId)?.name}</td>
                    <td className="px-2 py-1">{c.industry}</td>
                    <td className="px-2 py-1">{c.dealValue? `$${c.dealValue.toLocaleString()}` : '-'}</td>
                    <td className="px-2 py-1">{c.probability ?? '-' }%</td>
                    <td className="px-2 py-1 text-xs">{c.contactName ?? '-'}</td>
                    <td className="px-2 py-1 text-xs text-slate-400">
                      {/* per-row show/hide button and truncation */}
                      {(() => {
                        const visible = !!rowEmailVisible[c.id]
                        const permitted = currentUser?.role === 'Admin' || currentUserId === c.ownerId
                        const email = c.contactEmail ?? ''
                        if(!email) return <span className="inline-block align-middle">-</span>
                        if(visible && permitted){
                          return <span className="inline-block align-middle truncate max-w-[160px]">{email}</span>
                        }
                        // hidden or not permitted -> show masked
                        return <span className="inline-block align-middle text-slate-400 truncate max-w-[160px]">{maskEmail(email)}</span>
                      })()}
                      <button
                        className="ml-2 px-1 py-[2px] text-[11px] border rounded text-slate-700"
                        onClick={()=>toggleRowEmail(c.id)}
                        aria-label={rowEmailVisible[c.id] ? 'Hide email' : 'Show email'}
                      >
                        {rowEmailVisible[c.id] ? 'Hide' : 'Show'}
                      </button>
                    </td>
                    <td className="px-2 py-1">{c.region}/{c.country}</td>
                    <td className="px-2 py-1">{formatDate(c.lastActivityDate)}</td>
                    <td className="px-2 py-1">{latestAssignmentForClient(c.id)}</td>
                    <td className="px-2 py-1">{formatDate(c.nextFollowUpDate ?? null)}</td>
                    <td className="px-2 py-1">{String(c.healthScore)}</td>
                    <td className="px-2 py-1">
                      <button className="text-sky-600 mr-1 text-[12px]" onClick={()=>openEdit(c)}>View</button>
                      <button className="text-amber-600 mr-1 text-[12px]" onClick={()=>openEdit(c)}>Edit</button>
                      <button className="text-red-600 text-[12px]" onClick={()=>{ if(confirm(`Delete ${c.clientName}?`)) deleteClient(c.id) }}>Delete</button>
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
          <div className="w-full flex justify-end">
            <button aria-label={showAllRows ? 'Collapse table' : 'Show all rows'} title={showAllRows ? 'Collapse' : 'Show all'} onClick={()=>setShowAllRows(s=>!s)} className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
              <span className="text-xs">{showAllRows ? 'Showing all' : `Showing top ${TOP_ROWS}`}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${showAllRows ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L10 5.414 5.707 9.707A1 1 0 014.293 8.293l5-5A1 1 0 0110 3z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

          <div className="relative z-50 max-w-4xl w-full mx-4">
            <div className="bg-gradient-to-br from-white/95 to-slate-50/95 rounded-2xl shadow-2xl ring-1 ring-slate-200 p-8 transform-gpu" style={{ boxShadow: '0 12px 30px rgba(2,6,23,0.25), inset 0 1px 0 rgba(255,255,255,0.6)' }}>
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-2xl font-semibold">{editing? 'Edit Client' : 'Add Client'}</h3>
                <div className="flex items-center gap-3">
                  <button className="text-sm text-slate-600 px-3 py-2 rounded-md hover:bg-slate-100" onClick={close}>Cancel</button>
                  <Button onClick={save}>Save</Button>
                </div>
              </div>

              <form onSubmit={e=>{ e.preventDefault(); save() }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Top row: Client Name | Legal Name | Industry */}
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Client Name*</label>
                  <input required className="w-full border p-3 rounded-lg text-sm shadow-sm" placeholder="Client Name" value={form.clientName||''} onChange={e=>setForm({...form, clientName: e.target.value})} />
                  {errors.clientName && <div className="text-red-600 text-sm mt-1">{errors.clientName}</div>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Legal Name</label>
                  <input className="w-full border p-3 rounded-lg text-sm shadow-sm" placeholder="Legal Name" value={form.legalName||''} onChange={e=>setForm({...form, legalName: e.target.value})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Industry</label>
                  <input className="w-full border p-3 rounded-lg text-sm shadow-sm" placeholder="Industry" value={form.industry||''} onChange={e=>setForm({...form, industry: e.target.value})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Country</label>
                  <input list="country-list" className="w-full border p-3 rounded-lg text-sm shadow-sm" placeholder="Country" value={form.country||''} onChange={e=>setForm({...form, country: e.target.value})} />
                </div>

                {/* Owner & Status row */}
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Owner</label>
                  {/* only management (Manager or Admin) can change owner; others see their own as fixed */}
                  <select className="w-full border p-3 rounded-lg text-sm" value={form.ownerId||''} onChange={e=>setForm({...form, ownerId: e.target.value})} disabled={!(currentUser?.role === 'Admin' || currentUser?.role === 'Manager')}>
                    {team.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {errors.ownerId && <div className="text-red-600 text-sm mt-1">{errors.ownerId}</div>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Status</label>
                  <select className="w-full border p-3 rounded-lg text-sm" value={form.status||'Planned'} onChange={e=>setForm({...form, status: e.target.value as any})}>
                    <option>Planned</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>Canceled</option>
                    <option>Postponed</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Stage</label>
                  <select className="w-full border p-3 rounded-lg text-sm" value={form.pipelineStage||'Discovery'} onChange={e=>setForm({...form, pipelineStage: e.target.value as any})}>
                    <option>Discovery</option>
                    <option>Qualifying</option>
                    <option>ProposalSent</option>
                    <option>Negotiation</option>
                    <option>Contracting</option>
                    <option>Live</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Owner Email</label>
                  {/* editable only by management */}
                  <input className="w-full border p-3 rounded-lg text-sm" placeholder="owner@company.com" value={form.ownerEmail||''} onChange={e=>setForm({...form, ownerEmail: e.target.value})} disabled={!(currentUser?.role === 'Admin' || currentUser?.role === 'Manager')} />
                </div>

                {/* Business row */}
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Deal Value</label>
                  <input type="number" className="w-full border p-3 rounded-lg text-sm" placeholder="Deal Value" value={form.dealValue ?? 0} onChange={e=>setForm({...form, dealValue: Number(e.target.value)})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Probability (%)</label>
                  <input type="number" className="w-full border p-3 rounded-lg text-sm" placeholder="Probability" value={form.probability ?? 0} onChange={e=>setForm({...form, probability: Number(e.target.value)})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Services Interested</label>
                  <input className="w-full border p-3 rounded-lg text-sm" placeholder="Services Interested" value={(form.servicesInterested||[]).join(', ')} onChange={e=>setForm({...form, servicesInterested: e.target.value.split(',').map(s=>s.trim())})} />
                </div>

                {/* Primary Contact row */}
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Contact Name</label>
                  <input className="w-full border p-3 rounded-lg text-sm" placeholder="Contact Name" value={form.contactName||''} onChange={e=>setForm({...form, contactName: e.target.value})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Role</label>
                  <input className="w-full border p-3 rounded-lg text-sm" placeholder="Role" value={form.contactRole||''} onChange={e=>setForm({...form, contactRole: e.target.value})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Preferred Channel / Email</label>
                  <div className="flex gap-2 justify-end">
                    <select className="w-28 border p-3 rounded-lg text-sm" value={(form.preferredChannel as string) || 'Email'} onChange={e=>setForm({...form, preferredChannel: e.target.value as any})}>
                      <option>Email</option>
                      <option>Phone</option>
                      <option>WhatsApp</option>
                      <option>SMS</option>
                    </select>
                    <input className="w-36 border p-3 rounded-lg text-sm" placeholder="Contact Email" value={form.contactEmail||''} onChange={e=>setForm({...form, contactEmail: e.target.value})} />
                  </div>
                </div>

                {/* Engagement row: Next Follow-up | Last Activity | Next Meeting */}
                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Next Follow-up</label>
                  <input type="date" className="w-full border p-3 rounded-lg text-sm" value={form.nextFollowUpDate? (form.nextFollowUpDate as string).substr(0,10): ''} onChange={e=>setForm({...form, nextFollowUpDate: e.target.value? new Date(e.target.value).toISOString(): null})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Last Activity Date*</label>
                  <input type="date" className="w-full border p-3 rounded-lg text-sm" value={form.lastActivityDate? new Date(form.lastActivityDate).toISOString().substr(0,10) : ''} onChange={e=>setForm({...form, lastActivityDate: new Date(e.target.value).toISOString()})} />
                  {errors.lastActivityDate && <div className="text-red-600 text-sm mt-1">{errors.lastActivityDate}</div>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Next Meeting Date & Time</label>
                  <input type="datetime-local" className="w-full border p-3 rounded-lg text-sm" value={form.nextMeetingDateTime? new Date(form.nextMeetingDateTime).toISOString().slice(0,16) : ''} onChange={e=>setForm({...form, nextMeetingDateTime: e.target.value? new Date(e.target.value).toISOString(): null})} />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-slate-600 mb-2">Total months</label>
                  <input type="number" min={0} className="w-full border p-3 rounded-lg text-sm" placeholder="12" value={form.totalMonths ?? ''} onChange={e=>setForm({...form, totalMonths: e.target.value ? Number(e.target.value) : undefined})} />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm text-slate-600 mb-2">Notes</label>
                  <textarea className="w-full border p-3 rounded-lg text-sm h-24" placeholder="Notes" value={form.notes||''} onChange={e=>setForm({...form, notes: e.target.value})} />
                </div>

              </form>
              
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
