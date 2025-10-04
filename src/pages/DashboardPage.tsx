import React from 'react'
import { DollarSign, CalendarDays, Briefcase, Users, Activity, ChevronDown } from 'lucide-react'
import KPIStat from '../components/KPIStat'
import ActivityItem from '../components/ActivityItem'
import { useStore, useKPIs } from '../lib/store'
import GaugeCard from '../components/GaugeCard'

export default function DashboardPage(){
  const { activities, currentUser, team, clients } = useStore()
  const roleLower = String(currentUser?.role || '').toLowerCase()
  const isOwner = roleLower === 'owner'
  const isAdmin = roleLower === 'admin'
  const isPrivileged = isAdmin || isOwner
  const [filterOwner, setFilterOwner] = React.useState('')
  const [filterClient, setFilterClient] = React.useState('')
  const [filterMonth, setFilterMonth] = React.useState('') // YYYY-MM
  const kpis = useKPIs()

  // Helper: format numbers as currency with automatic K/M suffix, uppercase, 1 decimal, rounded up
  const formatShortCurrency = React.useCallback((value: number) => {
    const v = Number(value || 0)
    const sign = v < 0 ? '-' : ''
    const abs = Math.abs(v)
    if (abs >= 1_000_000) {
      const m = Math.ceil((abs / 1_000_000) * 10) / 10 // round up to 1 decimal
      return `${sign}$${m.toFixed(1)}M`
    }
    if (abs >= 1_000) {
      const k = Math.ceil((abs / 1_000) * 10) / 10 // round up to 1 decimal
      return `${sign}$${k.toFixed(1)}K`
    }
    // For sub-1k, round up to nearest integer
    const rounded = Math.ceil(abs)
    return `${sign}$${rounded.toLocaleString()}`
  }, [])

  // Build the allowed owner options based on role + market rules
  const teamForSelect = React.useMemo(() => {
    const adminTeamLower = String((currentUser as any)?.team || '').toLowerCase()
    if(isOwner) return team
    if(isAdmin){
      if(adminTeamLower.includes('all market')){
        // Admin (All Markets): Admins + Users (hide Owners)
        return team.filter(t => String((t as any).role||'').toLowerCase() !== 'owner')
      }
      // Admin (specific market): Users/BDMs in same market + self
      return team.filter(t => {
        const r = String((t as any).role||'').toLowerCase()
        const sameTeam = String((t as any).team||'').toLowerCase() === adminTeamLower
        const isUserLevel = r === 'user' || r === 'bdm'
        const isSelf = String(t.id) === String(currentUser.id)
        return isSelf || (isUserLevel && sameTeam)
      })
    }
    // User: self only
    return team.filter(t => String(t.id) === String(currentUser.id))
  }, [team, currentUser, isOwner, isAdmin])

  // Compute role/market-scoped owner ids for notification counts
  const allowedOwnerIds = React.useMemo(() => new Set(teamForSelect.map(t => String(t.id))), [teamForSelect])

  // Build a Next Actions list independent of the header filters for the notification bell
  const upcomingActivitiesAll = React.useMemo(() => {
    const grouped = new Map<string, typeof activities[0][]>()
    activities.forEach(a => {
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
    // Active assignments only (Planned or In Progress)
    return latestPerClient.filter(a => {
      const hasAssignment = a.assignment !== undefined && String(a.assignment).trim() !== ''
      const active = a.status === 'Planned' || a.status === 'In Progress'
      return hasAssignment && active
    })
  }, [activities])

  // Notification badge: show count of Next Actions for this user's scope
  const notificationCount = React.useMemo(() => {
    return upcomingActivitiesAll.filter(a => allowedOwnerIds.has(String(a.ownerId))).length
  }, [upcomingActivitiesAll, allowedOwnerIds])

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
  // Define active stages considered in the pipeline
  const activeStages = ['Discovery','Qualifying','Proposal Sent','Negotiation','Contracting','Live']
  const isActiveClient = (c: any) => activeStages.includes(String(c.pipelineStage||'')) && String(c.status||'') !== 'Canceled'
  const activeClients = filteredClients.filter(isActiveClient)
  // Total Contracts Value (sum of Deal column akin to Clients page, scoped by current filters)
  const totalContractsValue = filteredClients.reduce((s,c)=> s + Number(c.dealValue || 0), 0)
  // Monthly Recurring Value (MRV): sum of (dealValue / totalMonths) for active clients with totalMonths>0
  const monthlyRecurringValue = activeClients.reduce((s,c)=> {
    const months = Number((c as any).totalMonths||0)
    const value = Number(c.dealValue||0)
    return s + (months > 0 ? (value / months) : 0)
  }, 0)
  // Active Deals: number of deals currently in pipeline (by active stages)
  // Active deals: count clients with a non-zero deal value (not canceled). This aligns with the Clients table.
  const activeDeals = filteredClients.filter(c => Number(c.dealValue || 0) > 0 && String(c.status||'') !== 'Canceled').length
  // Client Engagement Coverage: % of clients with at least one planned/in-progress upcoming activity
  const nowTs = Date.now()
  const activitiesByClient = React.useMemo(() => {
    const m = new Map<string, typeof activities[0][]>()
    filteredActivities.forEach(a => {
      const cid = a.clientId || '_noclient_'
      const arr = m.get(cid) || []
      arr.push(a)
      m.set(cid, arr)
    })
    return m
  }, [filteredActivities])
  const coveredClientIds = new Set<string>()
  activitiesByClient.forEach((arr, cid) => {
    const hasUpcoming = arr.some(a => {
      if(!a.cut_off_date) return false
      const dt = new Date(a.cut_off_date)
      const future = dt.getTime() > nowTs
      const status = String(a.status||'')
      return future && (status === 'Planned' || status === 'In Progress')
    })
    if(hasUpcoming && cid !== '_noclient_') coveredClientIds.add(cid)
  })
  const engagementCoveragePct = Math.round((filteredClients.length ? (coveredClientIds.size / filteredClients.length) : 0) * 100)

  // pipeline stages summary
  const stages = ['Discovery','Qualifying','Proposal Sent','Negotiation','Contracting','Live']
  const pipelineCounts = stages.map(s => filteredClients.filter(c=> c.pipelineStage === s).length)
  const pipelineValues = stages.map(s => filteredClients
    .filter(c=> c.pipelineStage === s)
    .reduce((sum,c)=> sum + Number(c.dealValue || 0), 0)
  )
  // % of total deals at each stage (share of total active pipeline)
  const totalDealsFunnel = pipelineCounts.reduce((a,b)=> a + b, 0)
  const pipelinePercent = pipelineCounts.map(cnt => totalDealsFunnel > 0 ? Math.round((cnt / totalDealsFunnel) * 100) : 0)

  // Sales people visibility: include roles 'bdm' and 'user' within allowed scope
  const bdmVisible = team.filter(tm => {
    const r = String((tm as any).role||'').toLowerCase()
    return (r === 'bdm' || r === 'user') && allowedOwnerIds.has(String(tm.id))
  })
  const bdmPerf = bdmVisible.map(t => {
    const myClients = filteredClients.filter(c=> c.ownerId === t.id)
    const deals = myClients.filter(c=> (c.dealValue||0) > 0).length
    const value = myClients.reduce((s,c)=> s + Number(c.dealValue || 0), 0)
    const missingFollowups = myClients.filter(c=> !c.nextFollowUpDate).length
    return { ...t, deals, value, missingFollowups }
  }) as any[]
  // Sort by pipeline value (desc), then by # deals (desc); derive visible slice (top 5 by default)
  const [showAllBDM, setShowAllBDM] = React.useState(false)
  const bdmPerfSorted = React.useMemo(() => {
    return [...bdmPerf].sort((a:any,b:any) => {
      const byValue = Number(b.value||0) - Number(a.value||0)
      if(byValue !== 0) return byValue
      return Number(b.deals||0) - Number(a.deals||0)
    })
  }, [bdmPerf])
  const bdmPerfVisible = React.useMemo(() => showAllBDM ? bdmPerfSorted : bdmPerfSorted.slice(0,4), [showAllBDM, bdmPerfSorted])

  // next actions (upcoming activities) - one row per client: pick the nearest upcoming assigned action per client
  const upcomingAll = React.useMemo(() => {
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
    return assigned.sort((a,b) => dateKey(a) - dateKey(b))
  }, [filteredActivities])
  const [showAllNext, setShowAllNext] = React.useState(false)
  const upcomingVisible = React.useMemo(() => showAllNext ? upcomingAll : upcomingAll.slice(0,4), [showAllNext, upcomingAll])

  // (Removed Overdue & Missing Follow-ups card)

  // Engagement Health distribution based on follow-ups and recency
  const classifyEngagement = (c: any): 'healthy'|'risk'|'lost' => {
    const cid = c.id
    // Has an upcoming planned/in-progress activity?
    const arr = activitiesByClient.get(cid) || []
    const hasUpcoming = arr.some(a => {
      if(!a.cut_off_date) return false
      const dt = new Date(a.cut_off_date)
      const future = dt.getTime() > nowTs
      const status = String(a.status||'')
      return future && (status === 'Planned' || status === 'In Progress')
    })
    if(hasUpcoming) return 'healthy'
    // Check last activity recency
    const lastStr = c.lastActivityDate
    const last = lastStr ? new Date(lastStr) : null
    const daysSince = last ? Math.floor((nowTs - last.getTime()) / (24*60*60*1000)) : 9999
    const isClosedLost = String(c.pipelineStage||'') === 'Closed Lost' || String(c.status||'') === 'Canceled'
    if(isClosedLost || daysSince > 90) return 'lost'
    if(daysSince > 30) return 'risk'
    // No future follow-up scheduled yet -> treat as at risk to encourage scheduling
    return 'risk'
  }
  const healthCounts = filteredClients.reduce((acc, c) => {
    const cls = classifyEngagement(c)
    acc[cls]++
    return acc
  }, { healthy: 0, risk: 0, lost: 0 })
  const totalClients = Math.max(1, filteredClients.length)
  const pctHealthy = Math.round((healthCounts.healthy / totalClients) * 100)
  const pctRisk = Math.round((healthCounts.risk / totalClients) * 100)
  // Ensure total reaches 100 by assigning remainder to 'lost'
  const pctLost = Math.max(0, 100 - pctHealthy - pctRisk)

  // (Donut removed intentionally; keep layout sizes unchanged)

  // Gauges (MVP): Clients Added (30d) vs Target and Activity Recency (30d)
  const TARGET_CLIENTS_30D = 6
  const nowTsMs = Date.now()
  const thirtyDaysAgo = new Date(nowTsMs - 30*24*60*60*1000)
  function clientsAdded30dForOwner(ownerId: string){
    return clients.filter(c => {
      if(filterOwner && c.ownerId !== filterOwner) return false
      if(filterClient && c.id !== filterClient) return false
      if(String(c.ownerId) !== String(ownerId)) return false
      const createdRaw: any = (c as any).createdAt || (c as any).created_at || (c as any)['Created At']
      const created = createdRaw ? new Date(createdRaw) : null
      return !!created && created >= thirtyDaysAgo
    }).length
  }
  function scoreClientsAdded(ownerId: string){
    const added = clientsAdded30dForOwner(ownerId)
    const score = Math.min(100, Math.round((added / TARGET_CLIENTS_30D) * 100))
    return { added, score }
  }
  function activityRecencyForOwner(ownerId: string){
    // consider activities for owner; respect client filter
    const acts = activities.filter(a => String(a.ownerId) === String(ownerId) && (!filterClient || String(a.clientId) === String(filterClient)))
    let lastAt: Date | null = null
    for(const a of acts){
      const d1 = a.createdAt ? new Date(a.createdAt) : null
      const d2 = a.datetime ? new Date(a.datetime) : null
      const pick = d1 && !isNaN(d1.getTime()) ? d1 : (d2 && !isNaN(d2.getTime()) ? d2 : null)
      if(pick && (!lastAt || pick > lastAt)) lastAt = pick
    }
    const daysSince = lastAt ? Math.max(0, Math.floor((nowTsMs - lastAt.getTime()) / (24*60*60*1000))) : 9999
    const capped = Math.min(daysSince, 30)
    const value30 = 30 - capped // 30 at best (today), 0 when >=30 days
    const score = Math.round((value30 / 30) * 100)
    return { daysSince, score, value30 }
  }
  // team-level aggregates (visible BDMs)
  const visibleBdmIds = React.useMemo(() => bdmVisible.map(b => String(b.id)), [bdmVisible])
  function clientsAdded30dAvg(){
    const ids = filterOwner ? [String(filterOwner)] : visibleBdmIds
    const denom = Math.max(1, ids.length)
    const totalAdded = ids.reduce((sum, oid) => sum + clientsAdded30dForOwner(oid), 0)
    const avgAdded = totalAdded / denom
    const score = Math.min(100, Math.round((avgAdded / TARGET_CLIENTS_30D) * 100))
    return { avgAdded, score }
  }
  function activityRecencyAvg(){
    const ids = filterOwner ? [String(filterOwner)] : visibleBdmIds
    if(ids.length === 0) return { avgDays: 0, score: 0, avgValue30: 0 }
    const per = ids.map(oid => activityRecencyForOwner(oid))
    const score = Math.round(per.reduce((s,x)=> s + x.score, 0) / ids.length)
    // average days; treat missing (9999) as 30 (worst)
    const avgDays = Math.round(per.reduce((s,x)=> s + Math.min(x.daysSince, 30), 0) / ids.length)
    const avgValue30 = per.reduce((s,x)=> s + x.value30, 0) / ids.length
    return { avgDays, score, avgValue30 }
  }
  // choose target owners for gauges
  const gaugeOwnerIds: string[] = (function(){
    if(filterOwner) return [filterOwner]
    const visibleBdms = bdmVisible.map(b => String(b.id))
    if(visibleBdms.length) return visibleBdms.slice(0, 4)
    return [String(currentUser.id)]
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <select
              value={filterOwner}
              onChange={e=>setFilterOwner(e.target.value)}
              className="border rounded px-2 py-1 text-sm bg-white"
            >
              {isPrivileged ? (
                <option value="">{isOwner ? 'All owners' : 'All team'}</option>
              ) : null}
              {teamForSelect.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={filterClient}
              onChange={e=>setFilterClient(e.target.value)}
              className="border rounded px-2 py-1 text-sm bg-white"
            >
              {isPrivileged ? <option value="">All clients</option> : null}
              {(isPrivileged ? clients : clients.filter(c => c.ownerId === currentUser.id))
                .map(c => <option key={c.id} value={c.id}>{c.clientName}</option>)}
            </select>
            <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white" />
            <button onClick={() => { setFilterOwner(''); setFilterClient(''); setFilterMonth('') }} className="text-sm text-slate-500 hover:text-slate-700">Reset</button>
          </div>
        </div>
        {/* Duplicate avatar removed; Shell header already displays user avatar and logout */}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {/* Total Contracts Value */}
        <div className="p-5 rounded-xl shadow-[0_8px_24px_rgba(2,6,23,0.08)] border border-slate-100 bg-gradient-to-br from-indigo-50 to-violet-50">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <DollarSign size={16} />
            </span>
            <span>Total Contracts Value</span>
          </div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">{formatShortCurrency(totalContractsValue)}</div>
          <div className="text-xs text-slate-500 mt-2">Sum of Deal across filtered clients</div>
        </div>
        {/* Monthly Recurring Value */}
        <div className="p-5 rounded-xl shadow-[0_8px_24px_rgba(2,6,23,0.08)] border border-slate-100 bg-gradient-to-br from-sky-50 to-cyan-50">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 text-white">
              <CalendarDays size={16} />
            </span>
            <span>Monthly Recurring Value</span>
          </div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">{formatShortCurrency(monthlyRecurringValue)}</div>
          <div className="text-xs text-slate-500 mt-2">TCV ÷ commitment months</div>
        </div>
        {/* Active Deals */}
        <div className="p-5 rounded-xl shadow-[0_8px_24px_rgba(2,6,23,0.08)] border border-slate-100 bg-gradient-to-br from-emerald-50 to-teal-50">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <Briefcase size={16} />
            </span>
            <span>Active Deals</span>
          </div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">{activeDeals}</div>
          <div className="text-xs text-slate-500 mt-2">Deals currently in pipeline stages</div>
        </div>
        {/* Client Engagement */}
        <div className="p-5 rounded-xl shadow-[0_8px_24px_rgba(2,6,23,0.08)] border border-slate-100 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Users size={16} />
            </span>
            <span>Client Engagement</span>
          </div>
          <div className="text-3xl font-extrabold mt-3 text-slate-800">{engagementCoveragePct}%</div>
          <div className="text-xs text-slate-500 mt-2">Clients with a planned next touch</div>
        </div>
        {/* Engagement Health */}
        <div className="p-5 rounded-xl shadow-[0_8px_24px_rgba(2,6,23,0.08)] border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white">
              <Activity size={16} />
            </span>
            <span>Engagement Health</span>
          </div>
          {/* Values aligned like other KPI cards */}
          <div className="text-3xl font-extrabold mt-3 text-slate-800">
            <span className="relative inline-block group align-top">
              <span className="text-emerald-600 cursor-default">{healthCounts.healthy}</span>
              <span className="absolute left-0 top-full mt-1 z-10 w-72 px-3 py-2 rounded-md bg-white text-black text-sm font-normal leading-snug shadow-lg ring-1 ring-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>Healthy: Has an upcoming Planned or In Progress follow-up with a cut-off date.</span>
            </span>
            <span className="mx-3 text-slate-300">·</span>
            <span className="relative inline-block group align-top">
              <span className="text-amber-500 cursor-default">{healthCounts.risk}</span>
              <span className="absolute left-0 top-full mt-1 z-10 w-72 px-3 py-2 rounded-md bg-white text-black text-sm font-normal leading-snug shadow-lg ring-1 ring-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>At Risk: No upcoming follow-up with a cut-off date and last activity older than 30 days.</span>
            </span>
            <span className="mx-3 text-slate-300">·</span>
            <span className="relative inline-block group align-top">
              <span className="text-rose-600 cursor-default">{healthCounts.lost}</span>
              <span className="absolute left-0 top-full mt-1 z-10 w-72 px-3 py-2 rounded-md bg-white text-black text-sm font-normal leading-snug shadow-lg ring-1 ring-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>Lost: No contact for more than 90 days or closed-lost/canceled.</span>
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-2">Healthy / At Risk / Lost</div>
        </div>
      </div>

  <div className="grid grid-cols-12 gap-6">
        {/* Left column: narrower so right column can expand */}
  <div className="col-span-6 space-y-6">
      {/* Pipeline funnel summary */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Pipeline Funnel</div>
              <div className="text-sm text-slate-500">Counts · Value · % of total</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {stages.map((s,i)=> {
                const stageClassMap: Record<string, { bar: string; name: string; value: string }> = {
                  'Discovery': { bar: 'border-l-4 border-sky-500', name: 'text-sky-700', value: 'text-sky-700' },
                  'Qualifying': { bar: 'border-l-4 border-indigo-500', name: 'text-indigo-700', value: 'text-indigo-700' },
                  'Proposal Sent': { bar: 'border-l-4 border-violet-500', name: 'text-violet-700', value: 'text-violet-700' },
                  'Negotiation': { bar: 'border-l-4 border-amber-500', name: 'text-amber-700', value: 'text-amber-700' },
                  'Contracting': { bar: 'border-l-4 border-cyan-500', name: 'text-cyan-700', value: 'text-cyan-700' },
                  'Live': { bar: 'border-l-4 border-emerald-500', name: 'text-emerald-700', value: 'text-emerald-700' }
                }
                const ui = stageClassMap[s] || { bar: 'border-l-4 border-slate-300', name: 'text-slate-700', value: 'text-slate-700' }
                return (
                <div key={s} className={`p-3 bg-white rounded shadow-sm ${ui.bar}`}>
                  <div className="flex items-center justify-between">
                    <div className={`text-sm font-medium ${ui.name}`}>{s}</div>
                    <div className="text-sm text-slate-700 font-semibold">{pipelineCounts[i]}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 flex items-center justify-between">
                    <div>Value: <span className={`font-semibold ${ui.value}`}>${Math.round(pipelineValues[i]||0).toLocaleString()}</span></div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">→</span>
                      <span className="font-semibold">{pipelinePercent[i]}%</span>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </div>

          {/* BDM performance */}
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">BDM Performance</div>
              <button
                type="button"
                onClick={() => { if(bdmPerfSorted.length > 4) setShowAllBDM(s => !s) }}
                disabled={bdmPerfSorted.length <= 4}
                className={`inline-flex items-center justify-center w-6 h-6 rounded ${bdmPerfSorted.length > 4 ? 'hover:bg-slate-100' : 'opacity-40 cursor-not-allowed'}`}
                aria-label={showAllBDM ? 'Collapse to Top 4' : (bdmPerfSorted.length > 4 ? 'Show all' : 'Not enough rows')}
                title={showAllBDM ? 'Collapse to Top 4' : (bdmPerfSorted.length > 4 ? 'Show all' : 'Not enough rows')}
              >
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showAllBDM ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs table-auto">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500">
                    <th className="pb-1">BDM</th>
                    <th className="pb-1"># Deals</th>
                    <th className="pb-1">Pipeline</th>
                    <th className="pb-1">Missing FU</th>
                  </tr>
                </thead>
                <tbody>
                  {bdmPerfVisible.map(b=> (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-1">{b.name}</td>
                      <td className="py-1">{b.deals}</td>
                      <td className="py-1">${(b.value||0).toLocaleString()}</td>
                      <td className="py-1">{b.missingFollowups}</td>
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
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Next Actions</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">total actions: {upcomingAll.length}</span>
                <button
                  type="button"
                  onClick={() => { if(upcomingAll.length > 4) setShowAllNext(s => !s) }}
                  disabled={upcomingAll.length <= 4}
                  className={`inline-flex items-center justify-center w-6 h-6 rounded ${upcomingAll.length > 4 ? 'hover:bg-slate-100' : 'opacity-40 cursor-not-allowed'}`}
                  aria-label={showAllNext ? 'Collapse to Top 4' : (upcomingAll.length > 4 ? 'Show all' : 'Not enough rows')}
                  title={showAllNext ? 'Collapse to Top 4' : (upcomingAll.length > 4 ? 'Show all' : 'Not enough rows')}
                >
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showAllNext ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
            <div className="text-sm text-slate-500 mb-3">{isOwner ? '' : isAdmin ? 'Upcoming activities for your team' : 'Your upcoming activities'}</div>
            <div className="max-h-96 overflow-auto">
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
                  {upcomingVisible.map(a => {
                    // Derive postpone count across all activities for this client (max cumulative)
                    const arrForClient = activitiesByClient.get(a.clientId || '_noclient_') || []
                    const p = arrForClient.filter((x:any) => String(x.status) === 'Postponed').length
                    // Prefer the row cut-off; if absent, use nearest upcoming (or latest) cut-off from the client's history
                    let cut: Date | null = a.cut_off_date ? new Date(a.cut_off_date) : null
                    if(!cut){
                      const withCut = arrForClient.filter((x:any) => x.cut_off_date).map((x:any) => new Date(x.cut_off_date as any)).filter(d => !Number.isNaN(d.getTime()))
                      if(withCut.length){
                        const nowT = Date.now()
                        const future = withCut.filter(d => d.getTime() >= nowT).sort((x,y)=> x.getTime()-y.getTime())
                        const past = withCut.filter(d => d.getTime() < nowT).sort((x,y)=> y.getTime()-x.getTime())
                        cut = (future[0] || past[0] || null) as any
                      }
                    }
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
                          <td className="py-1.5 pl-4 align-top text-xs">{(a as any).ownerName || (team.find(t => String(t.id) === String(a.ownerId))?.name) || (a.ownerId ? String(a.ownerId) : '—')}</td>
                          <td className="py-1.5 text-xs align-top">{
                            (a.assignment && String(a.assignment).trim()) ? a.assignment : (() => {
                              const arr = (activitiesByClient.get(a.clientId || '_noclient_') || []).slice()
                              arr.sort((x:any,y:any)=> (y.version || 0) - (x.version || 0) || new Date(y.datetime).getTime() - new Date(x.datetime).getTime())
                              const found = arr.find((x:any)=> x && x.assignment && String(x.assignment).trim() !== '')
                              return found ? String(found.assignment) : '—'
                            })()
                          }</td>
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
                              <span className="text-slate-400 whitespace-nowrap">—</span>
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

          {/* Overdue & Missing Follow-ups removed; Next Actions extended in height */}

          {/* Performance Gauges (SVG) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              // If an owner filter is selected, show that person's metrics; otherwise show overall averages
              if(filterOwner){
                const ca = scoreClientsAdded(filterOwner)
                const ar = activityRecencyForOwner(filterOwner)
                return (
                  <>
                    <GaugeCard
                      title={`Clients Added (30d)`}
                      score={ca.score}
                      valueText={`6`}
                      subtitle={`Target 6/mo · Score ${ca.score}%`}
                      compact
                    />
                    <GaugeCard
                      title={`Activity Recency`}
                      score={ar.score}
                      valueText={`30`}
                      subtitle={`Last activity: ${ar.daysSince === 9999 ? 'n/a' : `${ar.daysSince} days ago`}`}
                      compact
                    />
                  </>
                )
              } else {
                const caAvg = clientsAdded30dAvg()
                const arAvg = activityRecencyAvg()
                return (
                  <>
                    <GaugeCard
                      title={`Clients Added (30d)`}
                      score={caAvg.score}
                      valueText={`6`}
                      subtitle={`Team average · Score ${caAvg.score}%`}
                      compact
                    />
                    <GaugeCard
                      title={`Activity Recency`}
                      score={arAvg.score}
                      valueText={`30`}
                      subtitle={`Avg last activity: ${arAvg.avgDays} days`}
                      compact
                    />
                  </>
                )
              }
            })()}
          </div>

          {/* Client Risk Matrix removed — colored badges added to Pipeline Funnel above */}
        </div>
      </div>
    </div>
  )
}
