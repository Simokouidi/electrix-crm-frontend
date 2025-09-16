import React from 'react'
import KPIStat from '../components/KPIStat'
import ActivityItem from '../components/ActivityItem'
import AvatarCircle from '../components/AvatarCircle'
import { useStore, useKPIs } from '../lib/store'

export default function DashboardPage(){
  const { activities, currentUser, team, clients } = useStore()
  const [filterOwner, setFilterOwner] = React.useState('')
  const [filterClient, setFilterClient] = React.useState('')
  const [filterMonth, setFilterMonth] = React.useState('') // YYYY-MM
  const kpis = useKPIs()

  // apply header filters to clients & activities so entire dashboard reflects selections
  const filteredClients = React.useMemo(() => clients.filter(c => {
    if(filterOwner && c.ownerId !== filterOwner) return false
    if(filterClient && c.id !== filterClient) return false
    return true
  }), [clients, filterOwner, filterClient])

  const filteredActivities = React.useMemo(() => activities.filter(a => {
    if(filterOwner && a.ownerId !== filterOwner) return false
    if(filterClient && a.clientId && filterClient && a.clientId !== filterClient) return false
    if(filterMonth){
      const [y,m] = filterMonth.split('-').map(Number)
      const dt = a.cut_off_date ? new Date(a.cut_off_date) : new Date(a.datetime)
      if(!(dt.getFullYear() === y && (dt.getMonth()+1) === m)) return false
    }
    return true
  }), [activities, filterOwner, filterClient, filterMonth])

  // derived metrics (based on filteredClients/filteredActivities)
  const totalPipelineValue = filteredClients.reduce((s,c)=> s + (c.dealValue||0), 0)
  const weightedPipeline = filteredClients.reduce((s,c)=> s + ((c.dealValue||0) * ((c.probability||0)/100)), 0)
  const activeDeals = filteredClients.filter(c=> c.pipelineStage === 'Live' || (c.dealValue||0) > 0).length
  const followUpsDue = filteredActivities.filter(a=> a.type === 'Follow-up' && new Date(a.datetime) > new Date()).length

  // pipeline stages summary
  const stages = ['Discovery','Qualifying','ProposalSent','Negotiation','Contracting','Live']
  const pipelineCounts = stages.map(s => filteredClients.filter(c=> c.pipelineStage === s).length)

  // BDM performance: only include actual BDMs and only for owners visible in filteredClients
  const ownerIds = Array.from(new Set(filteredClients.map(c => c.ownerId)))
  const bdmPerf = ownerIds.map(ownerId => {
    const t = team.find(tm => tm.id === ownerId)
    if(!t) return null
    if(t.role !== 'BDM') return null
    const myClients = filteredClients.filter(c=> c.ownerId === t.id)
    const deals = myClients.filter(c=> (c.dealValue||0) > 0).length
    const value = myClients.reduce((s,c)=> s + (c.dealValue||0), 0)
    const missingFollowups = myClients.filter(c=> !c.nextFollowUpDate).length
    return { ...t, deals, value, missingFollowups }
  }).filter(Boolean) as any[]

  // next actions (upcoming activities) - one row per client: pick the nearest upcoming assigned action per client
  const upcomingActivities = (() => {
    const grouped = new Map<string, typeof activities[0][]>()
    filteredActivities.forEach(a => {
      const cid = a.clientId || ('_noclient_' + a.id)
      const arr = grouped.get(cid) || []
      arr.push(a)
      grouped.set(cid, arr)
    })

    const latestPerClient: typeof activities = []
    grouped.forEach(arr => {
      arr.sort((x:any,y:any) => (y.version || 0) - (x.version || 0) || new Date(y.datetime).getTime() - new Date(x.datetime).getTime())
      latestPerClient.push(arr[0])
    })

    // select assigned/upcoming and not-completed
    const assigned = latestPerClient.filter(a => (a.assignment !== undefined && String(a.assignment).trim() !== '') && a.status !== 'Completed')
    const dateKey = (a: any) => a.cut_off_date ? new Date(a.cut_off_date).getTime() : new Date(a.datetime).getTime()
    return assigned.sort((a,b) => dateKey(a) - dateKey(b)).slice(0,8)
  })()

  // overdue & missing follow-ups (based on filteredClients)
  const today = new Date()
  const overdue = filteredClients.filter(c => c.nextFollowUpDate && new Date(c.nextFollowUpDate) < today)
  const missing = filteredClients.filter(c => !c.nextFollowUpDate)

  // client risk matrix counts by (health x stage)
  const healthLevels = ['Green','Amber','Red']
  const riskMatrix: Record<string, Record<string, number>> = {}
  healthLevels.forEach(h=> { riskMatrix[h] = {}; stages.forEach(s=> riskMatrix[h][s] = 0) })
  clients.forEach(c=> {
    const h = typeof c.healthScore === 'string' ? c.healthScore : (c.healthScore ? 'Green' : 'Amber')
    const s = c.pipelineStage || 'Discovery'
    if(riskMatrix[h] && riskMatrix[h][s]!==undefined) riskMatrix[h][s]++
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <select value={filterOwner} onChange={e=>setFilterOwner(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white">
              <option value="">All owners</option>
              {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white">
              <option value="">All clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.clientName}</option>)}
            </select>
            <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white" />
            <button onClick={() => { setFilterOwner(''); setFilterClient(''); setFilterMonth('') }} className="text-sm text-slate-500 hover:text-slate-700">Reset</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AvatarCircle name={currentUser.name} avatarUrl={currentUser.avatarUrl} unread={3} online={true} onClick={() => { /* open account menu */ }} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-100">
          <div className="text-sm text-slate-500">Total Pipeline Value</div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">${(totalPipelineValue/1000).toFixed(1)}k</div>
          <div className="text-xs text-slate-400 mt-2">Total value across open clients</div>
        </div>
        <div className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-100">
          <div className="text-sm text-slate-500">Weighted Pipeline Value</div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">${(weightedPipeline/1000).toFixed(0)}k</div>
          <div className="text-xs text-slate-400 mt-2">Probability-weighted estimate</div>
        </div>
        <div className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-100">
          <div className="text-sm text-slate-500">Active Deals</div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">{activeDeals}</div>
          <div className="text-xs text-slate-400 mt-2">Deals currently in pipeline</div>
        </div>
        <div className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-100">
          <div className="text-sm text-slate-500">Follow-up Coverage</div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">{Math.round((clients.filter(c=> c.nextFollowUpDate).length / Math.max(1, clients.length)) * 100)}%</div>
          <div className="text-xs text-slate-400 mt-2">% of clients with scheduled follow-up</div>
        </div>
        <div className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-md border border-slate-100">
          <div className="text-sm text-slate-500">Health Distribution</div>
          <div className="flex items-center gap-3 mt-3">
            <div className="text-2xl font-extrabold text-emerald-600">{Math.round((clients.filter(c=> c.healthScore==='Green').length / Math.max(1, clients.length))*100)}%</div>
            <div className="text-2xl font-extrabold text-amber-500">{Math.round((clients.filter(c=> c.healthScore==='Amber').length / Math.max(1, clients.length))*100)}%</div>
            <div className="text-2xl font-extrabold text-rose-600">{Math.round((clients.filter(c=> c.healthScore==='Red').length / Math.max(1, clients.length))*100)}%</div>
          </div>
          <div className="text-xs text-slate-400 mt-2">(G / A / R)</div>
        </div>
      </div>

  <div className="grid grid-cols-12 gap-6">
        {/* Left column: narrower so right column can expand */}
  <div className="col-span-6 space-y-6">
          {/* Pipeline funnel summary */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Pipeline Funnel</div>
              <div className="text-sm text-slate-500">By Stage</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {stages.map((s,i)=> (
                <div key={s} className="p-3 bg-slate-50 rounded">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">{s}</div>
                    <div className="text-sm text-slate-700 font-semibold">{pipelineCounts[i]}</div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 block" />
                      <span>{riskMatrix['Green'][s] || 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 block" />
                      <span>{riskMatrix['Amber'][s] || 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-rose-100 text-rose-800 text-xs">
                      <span className="w-2 h-2 rounded-full bg-rose-600 block" />
                      <span>{riskMatrix['Red'][s] || 0}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BDM performance */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">BDM Performance</div>
              <div className="text-sm text-slate-500">Deals · Pipeline Value · Missing Follow-ups</div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th>BDM</th>
                    <th># Deals</th>
                    <th>Pipeline</th>
                    <th>Missing FU</th>
                  </tr>
                </thead>
                <tbody>
                  {bdmPerf.map(b=> (
                    <tr key={b.id}>
                      <td className="py-2">{b.name}</td>
                      <td className="py-2">{b.deals}</td>
                      <td className="py-2">${(b.value||0).toLocaleString()}</td>
                      <td className="py-2">{b.missingFollowups}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: Next Actions + Overdue — expand to take remaining width */}
  <div className="col-span-6 space-y-6">
          {/* Next Actions */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="font-semibold mb-2">Next Actions</div>
            <div className="text-sm text-slate-500 mb-3">Upcoming activities for the team</div>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pl-0 align-top">Client</th>
                    <th className="text-center align-top">P</th>
                    <th className="pl-4 align-top">Owner</th>
                    <th className="align-top">Assignment</th>
                    <th className="text-right pr-3 align-top">Cut-off</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingActivities.map(a => {
                    const cut = a.cut_off_date ? new Date(a.cut_off_date) : null
                    const p = a.postpones_count || 0
                    const isPostponed = p > 0 || a.status === 'Postponed'
                    const isCompletedOrCanceled = a.status === 'Completed' || a.status === 'Canceled'
                    const isLate = cut ? (cut.getTime() < Date.now() && !isCompletedOrCanceled && !isPostponed) : false
                    // on-time: green if >3 days, amber if <=3 days
                    let onTimeState: 'green' | 'amber' | null = null
                    if(!isPostponed && !isLate && cut && !isCompletedOrCanceled){
                      const daysLeft = Math.ceil((cut.getTime() - Date.now()) / (24*60*60*1000))
                      onTimeState = daysLeft <= 3 ? 'amber' : 'green'
                    }
                    return (
                      <tr key={a.id}>
                        <td className="py-1.5 pl-0 align-top text-xs">{clients.find(c=>c.id===a.clientId)?.clientName || '-'}</td>
                          <td className="py-1.5 text-center text-xs">{p}</td>
                          <td className="py-1.5 pl-4 align-top text-xs">{team.find(t=>t.id===a.ownerId)?.name}</td>
                          <td className="py-1.5 text-xs align-top">{a.assignment || '-'}</td>
                          <td className="py-1.5 text-right pr-3 align-top text-xs">
                          {isPostponed ? (
                            <div className="flex items-center justify-end gap-3 text-red-600">
                              <div className={`flex-none w-2 h-4 rounded-sm ${p === 1 ? 'bg-amber-400' : p === 2 ? 'bg-orange-500' : 'bg-rose-600'}`} />
                              <div className="flex items-center gap-3">
                                <span className="whitespace-nowrap font-medium">{cut ? new Date(cut).toLocaleDateString() : 'Pstp'}</span>
                                <span className="flex-none text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">Pstp</span>
                              </div>
                              {!cut && <div className="ml-2 text-xs text-slate-400">Pending manager cut-off</div>}
                            </div>
                          ) : (
                            cut ? (
                              <div className="flex items-center justify-end gap-3">
                                <span className={isLate ? 'whitespace-nowrap text-red-600 font-semibold' : onTimeState === 'amber' ? 'whitespace-nowrap text-amber-600 font-medium' : onTimeState === 'green' ? 'whitespace-nowrap text-emerald-600 font-medium' : 'whitespace-nowrap text-slate-700'}>{cut.toLocaleDateString()}</span>
                                {isLate && <span className="flex-none text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">Late</span>}
                                {!isLate && onTimeState === 'amber' && <span className="flex-none text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Ontm</span>}
                                {!isLate && onTimeState === 'green' && <span className="flex-none text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Ontm</span>}
                              </div>
                            ) : (
                              <span className="text-slate-400 whitespace-nowrap">{new Date(a.datetime).toLocaleDateString()}</span>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue & Missing Follow-ups */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="font-semibold mb-2">Overdue & Missing Follow-ups</div>
            <div className="text-sm text-slate-500 mb-3">Overdue: {overdue.length} · Missing: {missing.length}</div>
            <div className="space-y-2">
              {overdue.slice(0,6).map(c=> (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="text-sm">{c.clientName}</div>
                  <div className="text-xs text-red-600">Overdue</div>
                </div>
              ))}
            </div>
          </div>

          {/* Client Risk Matrix removed — colored badges added to Pipeline Funnel above */}
        </div>
      </div>
    </div>
  )
}
