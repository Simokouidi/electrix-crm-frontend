import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { io as ioClient } from 'socket.io-client'

export type TeamMember = { id: string; name: string; email?: string; personalEmail?: string; avatarUrl?: string; role?: string; phone?: string; password?: string; managerId?: string; team?: string }
export type CompanySize = '1-50'|'51-200'|'201-1000'|'1001+'
export type PipelineStage = 'Discovery'|'Qualifying'|'Proposal Sent'|'Negotiation'|'Contracting'|'Live'
export type Status = 'Planned'|'In Progress'|'Completed'|'Canceled'|'Postponed'|'Prospect'
export type Health = 'Green'|'Amber'|'Red'

export type Client = {
  id: string
  clientName: string
  legalName?: string
  industry?: string
  companySize?: CompanySize
  region?: string
  country?: string
  ownerId: string
  ownerEmail?: string
  status: Status
  pipelineStage?: PipelineStage
  dealValue?: number
  probability?: number
  servicesInterested?: string[]
  tags?: string[]
  contactName?: string
  contactRole?: string
  contactEmail?: string
  contactPhone?: string
  preferredChannel?: 'Email'|'Phone'|'WhatsApp'|'SMS'
  lastActivityDate: string
  nextFollowUpDate?: string | null
  nextMeetingDateTime?: string | null
    notes?: string
    totalMonths?: number
  slaTier?: 'Bronze'|'Silver'|'Gold'|'Platinum'
  projectStartDate?: string | null
  projectEndDate?: string | null
  contractRenewalDate?: string | null
  healthScore?: Health | number
  createdAt?: string
  updatedAt?: string
}
export type Activity = { id: string; parentId?: string; version?: number; type: 'Meeting'|'Task'|'Deal'|'Follow-up'; title: string; notes?: string; clientId?: string; ownerId: string; datetime: string; status: 'Planned'|'In Progress'|'Completed'|'Canceled'|'Postponed'; assignment?: string; cut_off_date?: string | null; postpones_count?: number; postponedBy?: string | null; createdAt?: string; updatedAt?: string }

const now = new Date()
const daysAgo = (d:number)=> new Date(Date.now()-d*24*60*60*1000).toISOString()

const seedTeam: TeamMember[] = [
  // Owners
  { id: 't-simo', name: 'Simo Kouidi', email: 'Simo.kouidi@electrixspace.com', role: 'Owner', team: 'All Markets', phone: '', password: 'Kouidi' },
  { id: 't-andrea', name: 'Andrea Di Palma', email: 'andrea.dipalma@electrixspace.com', role: 'Owner', team: 'All Markets', phone: '', password: 'Dipalma' },
  { id: 't-electrix', name: 'ELECTRIX', email: 'careforce@electrixspace.com', role: 'Owner', team: 'All Markets', phone: '', password: 'Careforce' },
  // Admins
  { id: 't-mohammad', name: 'Mohammad Jazzar', email: 'Mohammad.Jazzar@electrixspace.com', role: 'Admin', team: 'Saudi Arabia', phone: '', password: 'Jazzar' },
  { id: 't-chris', name: 'Christopher Poon', email: 'Christopher.poon@electrixspace.com', role: 'Admin', team: 'All Markets', phone: '', password: 'Poon' },
  // Users (BDM) — assign market teams; most report to Mohammad (Saudi Arabia)
  { id: 't-youssef', name: 'Youssef Boussetta', email: 'Youssef.boussetta@electrixspace.com', role: 'BDM', team: 'Saudi Arabia', phone: '', password: 'Boussetta', managerId: 't-mohammad' },
  { id: 't-mwasim', name: 'Mohammed Wasim', email: 'Mohammed.Wasim@electrixspace.com', role: 'BDM', team: 'Saudi Arabia', phone: '', password: 'Wasim', managerId: 't-mohammad' },
  { id: 't-mali', name: 'Mohammed Ali', email: 'Mohammed.Ali@electrixspace.com', role: 'BDM', team: 'Saudi Arabia', phone: '', password: 'Ali', managerId: 't-mohammad' },
  { id: 't-eslam', name: 'Eslam El Malah', email: 'Eslam.elmalah@electrixspace.com', role: 'BDM', team: 'Saudi Arabia', phone: '', password: 'Elmalah', managerId: 't-mohammad' },
  { id: 't-abdulfattah', name: 'Abdulfattah Aljamal', email: 'Abdulfattah.aljamal@electrixspace.com', role: 'BDM', team: 'Saudi Arabia', phone: '', password: 'Aljamal', managerId: 't-mohammad' },
  { id: 't-sami', name: 'Sami Alsawaftah', email: 'Sami.alsawaftah@electrixspace.com', role: 'BDM', team: 'Saudi Arabia', phone: '', password: 'Alsawaftah', managerId: 't-mohammad' },
  { id: 't-arman', name: 'Arman Aras', email: 'Arman.Aras@electrixspace.com', role: 'BDM', team: 'Dubai Sales', phone: '', password: 'Aras' },
]

// generate a few clients per person (3 each) to populate views and test RBAC
const makeClientFor = (owner: TeamMember, i: number): Client => {
  const short = owner.name.split(' ')[0].replace(/[^A-Za-z0-9]/g,'')
  const id = `c-${owner.id}-${i+1}`
  const createdAt = daysAgo(5 + i)
  return {
    id,
    clientName: `${short} Co ${i+1}`,
    legalName: `${short} Corporation ${i+1}`,
    industry: i % 2 === 0 ? 'Technology' : 'Services',
    companySize: i % 3 === 0 ? '201-1000' : '1-50',
    region: i % 2 === 0 ? 'EMEA' : 'APAC',
    country: i % 2 === 0 ? 'GB' : 'AE',
    ownerId: owner.id,
    status: i % 2 === 0 ? 'In Progress' : 'Planned',
    pipelineStage: i % 2 === 0 ? 'Live' : 'Discovery',
    dealValue: (i+1) * 5000,
    probability: 30 + i * 20,
    contactName: `${short} Contact`,
    contactEmail: `${owner.email ? owner.email.split('@')[0] : short}.client${i+1}@example.com`,
    preferredChannel: 'Email',
    lastActivityDate: daysAgo(i+1),
    nextFollowUpDate: null,
    notes: 'Auto-generated for demo',
    healthScore: 'Green',
    createdAt,
    updatedAt: createdAt
  }
}

// base static clients to preserve a few canonical ids (optional)
const baseClients: Client[] = [
  {
    id: 'c-1',
    clientName: 'Aurora Co',
    legalName: 'Aurora Corporation',
    industry: 'Technology',
    companySize: '51-200',
    region: 'EMEA',
    country: 'GB',
    ownerId: 't-simo',
    status: 'Planned',
    pipelineStage: 'Discovery',
    dealValue: 0,
    probability: 10,
    contactName: 'A. Contact',
    contactEmail: 'contact@aurora.example',
    preferredChannel: 'Email',
    lastActivityDate: daysAgo(2),
    nextFollowUpDate: null,
    notes: 'Seed prospect',
    healthScore: 'Green',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2)
  },
  {
    id: 'c-2',
    clientName: 'Bluebird LLC',
    industry: 'Retail',
    companySize: '1-50',
    region: 'APAC',
    country: 'PK',
    ownerId: 't-andrea',
    status: 'In Progress',
    pipelineStage: 'Live',
    dealValue: 12000,
    probability: 90,
    contactName: 'Fatima Rep',
    contactEmail: 'fatima@bluebird.example',
    preferredChannel: 'Phone',
    lastActivityDate: daysAgo(1),
    nextFollowUpDate: daysAgo(3),
    notes: 'Active customer',
    healthScore: 'Green',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1)
  },
  {
    id: 'c-3',
    clientName: 'Crescent Ltd',
    industry: 'Finance',
    companySize: '201-1000',
    region: 'AMER',
    country: 'US',
    ownerId: 't-chris',
    status: 'Completed',
    pipelineStage: 'Contracting',
    dealValue: 75000,
    probability: 100,
    contactName: 'Chris Buyer',
    contactEmail: 'chris@crescent.example',
    preferredChannel: 'Email',
    lastActivityDate: daysAgo(5),
    nextFollowUpDate: null,
    notes: 'Enterprise customer',
    healthScore: 'Amber',
    createdAt: daysAgo(40),
    updatedAt: daysAgo(5)
  }
]

// generate three clients per person (for demo load)
const generatedClients: Client[] = seedTeam.flatMap(member => {
  // skip the service pseudo-user
  if(member.id === 't-electrix') return []
  return [0,1,2].map(i => makeClientFor(member,i))
})

// combine base + generated; ensure unique ids
const seedClients: Client[] = [...baseClients, ...generatedClients]

// create a primary activity (Deal) for many seeded clients so views show deals
const seedActivities: Activity[] = []
// add a few canonical activities
seedActivities.push({ id: 'a-1', parentId: 'a-1', version: 1, type: 'Meeting', title: 'Intro call', ownerId: 't-andrea', clientId: 'c-1', datetime: daysAgo(1), status: 'Planned', assignment: 'Call client', cut_off_date: daysAgo(0), postpones_count: 0 })
seedActivities.push({ id: 'a-2', parentId: 'a-2', version: 1, type: 'Task', title: 'Prepare proposal', ownerId: 't-chris', clientId: 'c-3', datetime: daysAgo(2), status: 'Completed', assignment: 'Send proposal', cut_off_date: daysAgo(2), postpones_count: 0 })
seedActivities.push({ id: 'a-3', parentId: 'a-3', version: 1, type: 'Deal', title: 'Contract signed', ownerId: 't-chris', clientId: 'c-3', datetime: daysAgo(5), status: 'Completed', assignment: 'Finalize contract', cut_off_date: daysAgo(5), postpones_count: 0 })

// for each generated client add a Deal activity
generatedClients.forEach((c, idx) => {
  const act: Activity = {
    id: `a-${c.id}`,
    parentId: `a-${c.id}`,
    version: 1,
    type: 'Deal',
    title: `Opportunity - ${c.clientName}`,
    notes: 'Auto-seeded deal',
    clientId: c.id,
    ownerId: c.ownerId,
    datetime: daysAgo((idx % 7) + 1),
    status: idx % 3 === 0 ? 'In Progress' : 'Planned',
    assignment: 'Close opportunity',
    cut_off_date: null,
    postpones_count: 0
  }
  seedActivities.push(act)
})

type Store = {
  team: TeamMember[]
  clients: Client[]
  activities: Activity[]
  activitiesSynced: boolean
  dataSynced: boolean
  authUser: TeamMember | null
  currentUserId: string
  currentUser: TeamMember
  setCurrentUserId?: (id: string) => void
  showSettingsSections: boolean
  setShowSettingsSections: React.Dispatch<React.SetStateAction<boolean>>
  selectedSettingsTab: string
  setSelectedSettingsTab: React.Dispatch<React.SetStateAction<string>>
  addClient: (c: Omit<Client,'id'|'createdAt'|'updatedAt'>) => Promise<Client>
  updateClient: (id:string, patch: Partial<Client>) => Promise<Client | null>
  deleteClient: (id:string)=>Promise<boolean>
  addActivity: (a: Omit<Activity,'id'>)=>void
  updateActivity: (id: string, patch: Partial<Activity>) => Promise<Activity | null>
  reset: ()=>void
  // auth (simple in-memory for prototype)
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  // simulate sending WhatsApp messages (in-memory)
  sendWhatsApp: (toId: string, message: string, opts?: { templateName?: string }) => Promise<any>
  notifications: { toId: string; message: string; timestamp: string; meta?: any; error?: string }[]
  notifyStatusChange: (activity: Activity, changerId: string, note: string) => Promise<void>
  notifyAssignment: (activity: Activity, assignedToId: string, managerId: string, note: string) => Promise<void>
  setWhatsAppCredentials: (token: string, phoneId: string) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }){
  // Start empty: prefer DB-driven data. Seeded data used only as a fallback when API is unreachable.
  const [team,setTeam] = useState<TeamMember[]>([])
  const [clients,setClients] = useState<Client[]>([])
  const [activities,setActivities] = useState<Activity[]>([])
  const [activitiesSynced, setActivitiesSynced] = useState<boolean>(false)
  const [dataSynced, setDataSynced] = useState<boolean>(false)
  const [socket, setSocket] = useState<any | null>(null)
  // Persisted authenticated user (id/email/name/role) to keep identity stable across refreshes and polling
  const [authUser, setAuthUser] = useState<TeamMember | null>(() => {
    try{
      const raw = typeof window !== 'undefined' ? localStorage.getItem('AUTH_USER') : null
      return raw ? (JSON.parse(raw) as TeamMember) : null
    }catch{ return null }
  })

  // Initialize API base:
  // 1) Allow runtime override via localStorage 'API_BASE' (handy for static hosting + separate API origin)
  // 2) Use VITE_API_BASE if provided at build time
  // 3) During local development, default to the backend on port 4000
  let API_BASE = ''
  try{
    if(typeof window !== 'undefined'){
      const ls = localStorage.getItem('API_BASE')
      if(ls) API_BASE = ls
    }
  }catch{/* ignore storage errors */}
  if(!API_BASE){
    API_BASE = (import.meta as any).env?.VITE_API_BASE || ''
  }
  if(!API_BASE && typeof window !== 'undefined'){
    const host = (window.location && window.location.hostname) || 'localhost'
    if(host === 'localhost' || host === '127.0.0.1'){
      API_BASE = 'http://localhost:4000'
    }
  }

  // Compose headers carrying the current authenticated user identity for server-side RLS
  function withUserHeaders(init?: RequestInit): RequestInit{
    const roleLower = String((authUser?.role || (currentUser as any)?.role || '')).toLowerCase()
    // Owners must see absolutely everything — do NOT send RLS headers so backend returns full datasets
    if(roleLower === 'owner'){
      return { ...(init || {}), headers: { ...(init?.headers as any) } }
    }
    const headers: Record<string, string> = {
      'X-User-Id': String((authUser?.id || currentUserId || '')),
      'X-User-Email': String(((authUser?.email) || (currentUser?.email) || ''))
    }
    return { ...(init || {}), headers: { ...(init?.headers as any), ...headers } }
  }

  // helper: convert snake_case DB rows to camelCase frontend shape
  function snakeToCamel(s: string){ return s.replace(/_([a-z])/g, (_,c)=>c.toUpperCase()) }
  function normalizeClientRow(row: any){
    if(!row || typeof row !== 'object') return row
    const out: any = {}
    // 1) Start with snake->camel pass-through
    for(const k of Object.keys(row)){
      const kc = snakeToCamel(k)
      out[kc] = row[k]
    }
    // 2) Stabilize id as string
    if(out.id !== undefined && out.id !== null) out.id = String(out.id)
    // 3) Map known DB variants to our canonical frontend fields
    // Stage: some DBs use `stage` instead of `pipeline_stage`
    if(out.pipelineStage === undefined){
      out.pipelineStage = out.stage ?? out.Stage ?? out.pipeline_stage ?? out.PipelineStage
    }
    // Owner: prefer explicit ownerId/owner_id; else fall back to Owner/owner (name string)
    if(out.ownerId === undefined){
      const rawOwnerId = out.owner_id ?? out.ownerId
      if(rawOwnerId !== undefined && rawOwnerId !== null){
        out.ownerId = String(rawOwnerId)
      } else if(out.Owner || out.owner){
        // keep the owner name for UI fallback; try to preserve as ownerName
        out.ownerName = out.Owner || out.owner
      }
    }
    // Owner Email variants (owner_email, OwnerEmail, 'Owner Email')
    if(out.ownerEmail === undefined){
      out.ownerEmail = out.owner_email ?? out.OwnerEmail ?? out['Owner Email'] ?? out.owneremail
    }
    // Country/Region may be capitalized in DB exports
    if(out.country === undefined) out.country = out.Country ?? out.country
    if(out.region === undefined) out.region = out.Region ?? out.region
    // Contact fields variants
    if(out.contactEmail === undefined) out.contactEmail = out.contact_email ?? out.ContactEmail ?? out['Contact Email'] ?? out.Email ?? out.email
    if(out.contactName === undefined) out.contactName = out.contact_name ?? out.ContactName ?? out['Contact Name']
    // Dates: ensure ISO strings when possible (leave as-is if already ISO or null)
    const toIso = (v:any)=>{
      if(!v) return v
      const d = new Date(v)
      return isNaN(d.getTime()) ? v : d.toISOString()
    }
    if(out.lastActivityDate) out.lastActivityDate = toIso(out.lastActivityDate)
    if(out.nextFollowUpDate) out.nextFollowUpDate = toIso(out.nextFollowUpDate)
    if(out.nextMeetingDateTime) out.nextMeetingDateTime = toIso(out.nextMeetingDateTime)
    // Industry often matches directly; include capitalized variant
    if(out.industry === undefined) out.industry = out.Industry ?? out.industry
    // Status sometimes capitalized in DB exports
    if(out.status === undefined) out.status = out.Status ?? out.status
    return out
  }

  function normalizeActivityRow(row: any){
    if(!row || typeof row !== 'object') return row
    const get = (...keys: string[]) => {
      for(const k of keys){ if(k === undefined) continue; if(row[k] !== undefined) return row[k] }
      return undefined
    }
    const out: any = {}
    // Primary id may be activityId / activity_id / id
    const rawId = get('id','activityId','activity_id')
    out.id = rawId !== undefined && rawId !== null ? String(rawId) : undefined
  const rawClientId = get('clientId','client_id','Client')
  const rawOwnerId = get('ownerId','owner_id','Owner')
  out.clientId = rawClientId !== undefined && rawClientId !== null ? String(rawClientId) : undefined
  out.ownerId = rawOwnerId !== undefined && rawOwnerId !== null ? String(rawOwnerId) : undefined
    out.type = get('type','Type')
    out.title = get('title','Title')
    out.notes = get('notes','note','Notes')
    out.datetime = get('datetime','Date','scheduled_at','createdAt','Created At')
    out.status = get('status','Status')
  if(out.status === 'Cancelled') out.status = 'Canceled'
    out.assignment = get('assignment','Assignment')
    out.cut_off_date = get('cut_off_date','Cut-off','Cut off','Cut Off','Cut off date','Cut Off Date')
    out.postpones_count = get('postpones_count')
    // created/updated timestamps
    out.createdAt = get('createdAt','created_at','Created At')
    out.updatedAt = get('updatedAt','updated_at','Updated At')
    return out
  }

  function normalizeTeamRow(row: any){
    if(!row || typeof row !== 'object') return row
    const out:any = { ...row }
    if(out.id !== undefined && out.id !== null) out.id = String(out.id)
    // Preserve common fields like role, email, team/market if present
    if(out.team === undefined && (row.Team || row.market)) out.team = row.Team || row.market
    // Map DB personal_email -> personalEmail for frontend use
    if(out.personalEmail === undefined && (row.personal_email !== undefined || (row as any).PersonalEmail !== undefined)){
      out.personalEmail = row.personal_email ?? (row as any).PersonalEmail
    }
    return out
  }

  useEffect(() => {
    // connect socket
    try{
      const s = ioClient(API_BASE || undefined);
      setSocket(s);
      s.on('connect', () => console.info('Socket connected', s.id));
      s.on('clients:created', (c: any) => {
        const mapped = normalizeClientRow(c)
        setClients(prev => prev.some(p => p.id === mapped.id) ? prev : [mapped, ...prev])
      });
      s.on('clients:updated', (c: any) => {
        const mapped = normalizeClientRow(c)
        setClients(prev => prev.map(p => p.id === mapped.id ? mapped : p))
      });
      s.on('clients:deleted', ({ id }: any) => setClients(prev => prev.filter(p => p.id !== id)));

  s.on('activities:created', (a: any) => { const na = normalizeActivityRow(a); setActivities(prev => prev.some(p => p.id === na.id) ? prev : [na, ...prev]) });
  s.on('activities:updated', (a: any) => { const na = normalizeActivityRow(a); setActivities(prev => prev.map(p => p.id === na.id ? na : p)) });
  s.on('activities:deleted', ({ id }: any) => setActivities(prev => prev.filter(p => p.id !== String(id))));

      s.on('users:created', (u: any) => setTeam(prev => prev.some(p => p.id === u.id) ? prev : [u, ...prev]));
      s.on('users:updated', (u: any) => setTeam(prev => prev.map(p => p.id === u.id ? u : p)));
      s.on('users:deleted', ({ id }: any) => setTeam(prev => prev.filter(p => p.id !== id)));

      return () => { s.disconnect(); }
    }catch(e){ console.warn('Socket init failed', e) }
  }, [])

  // If the app default `currentUserId` doesn't exist in the server-provided team
  // (e.g. the DB has numeric ids or different ids), switch to the first available
  // server user so visibility filters (clients/activities) show results.
  useEffect(() => {
    if(!team || team.length === 0) return
    // If authenticated, do NOT override current user to someone else.
    // Try to align the currentUserId to the same person in the latest team list by id or email.
    if(isAuthenticated && authUser){
      const byId = team.find(t => String(t.id) === String(authUser.id))
      if(byId && currentUserId !== byId.id){ setCurrentUserId(String(byId.id)) ; return }
      // Fallback: find by email
      if(authUser.email){
        const byEmail = team.find(t => String((t.email||'')).toLowerCase() === String(authUser.email).toLowerCase())
        if(byEmail && currentUserId !== byEmail.id){ setCurrentUserId(String(byEmail.id)); return }
      }
      // As a last resort, keep the existing currentUserId (no override) to avoid flipping identities.
      return
    }
    // If not authenticated, choose a reasonable default so demo pages render
    const exists = team.find(t => t.id === currentUserId)
    if(!exists){
      const preferred = team.find(t => {
        const r = String((t as any).role || '').toLowerCase()
        return r === 'owner' || r === 'admin'
      })
      const pick = preferred ? preferred.id : team[0].id
      setCurrentUserId(String(pick))
    }
  }, [team])

  useEffect(() => {
    // initial fetch from API; fall back to seed data if unavailable
    async function fetchAll(){
      try{
        const base = API_BASE || ''
        const [teamRes, clientsRes, activitiesRes] = await Promise.all([
          fetch(base + '/api/users', withUserHeaders()).then(r => r.ok ? r.json() : Promise.reject(r.status)),
          fetch(base + '/api/clients', withUserHeaders()).then(r => r.ok ? r.json() : Promise.reject(r.status)),
          fetch(base + '/api/activities', withUserHeaders()).then(r => r.ok ? r.json() : Promise.reject(r.status))
        ])
  // normalize responses: server may return { data: [...] } or [...]
  const teamData = Array.isArray(teamRes) ? teamRes : (teamRes && Array.isArray((teamRes as any).data) ? (teamRes as any).data : [])
  const clientsData = Array.isArray(clientsRes) ? clientsRes : (clientsRes && Array.isArray((clientsRes as any).data) ? (clientsRes as any).data : [])
  const activitiesData = Array.isArray(activitiesRes) ? activitiesRes : (activitiesRes && Array.isArray((activitiesRes as any).data) ? (activitiesRes as any).data : [])
    if(teamData.length) setTeam(teamData)
    else setTeam(prev => prev.length ? prev : seedTeam)
  if(clientsData.length) setClients(clientsData.map(normalizeClientRow))
    else setClients(prev => prev.length ? prev : seedClients)
  if(activitiesData.length) {
    setActivities(activitiesData.map(normalizeActivityRow))
    setActivitiesSynced(true)
  } else {
    setActivities(prev => prev.length ? prev : seedActivities)
    setActivitiesSynced(true)
  }

        // If the API is reachable but the clients table is empty, automatically push
        // the local seed clients to the backend once per browser (helps bootstrap remote DB).
        try{
          const pushedFlagKey = 'electrix_seed_pushed'
          if(Array.isArray(clientsRes) && clientsRes.length === 0 && !localStorage.getItem(pushedFlagKey)){
            console.info('Remote DB empty — pushing seed clients from browser to backend...')
            // send sequentially to avoid overwhelming DB on very large seeds
            for(const c of seedClients){
              // build payload matching frontend client shape (camelCase)
              const payload:any = { ...c }
              // remove id/createdAt/updatedAt so DB generates its own
              delete payload.id; delete payload.createdAt; delete payload.updatedAt
              try{
                const resp = await fetch(base + '/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                if(!resp.ok) {
                  const txt = await resp.text().catch(()=>'')
                  console.warn('Seed client push failed', resp.status, txt)
                } else {
                  const created = await resp.json().catch(()=>null)
                  const row = created && created.data ? created.data : created
                  if(row) setClients(prev => prev.some(c => c.id === (row.id && String(row.id))) ? prev : [normalizeClientRow(row), ...prev])
                }
            }catch(e){
              console.warn('API fetch failed, using seeded data', e)
                  // Local fallback to ensure UI remains populated for demo/offline use
                  try{ setTeam(prev => prev.length ? prev : seedTeam) }catch{}
                  try{ setClients(prev => prev.length ? prev : seedClients) }catch{}
                  try{ setActivities(prev => prev.length ? prev : seedActivities) }catch{}
                  try{ setActivitiesSynced(true) }catch{}
                break
              }
            }
            try{ localStorage.setItem(pushedFlagKey, '1') }catch(e){}
            console.info('Seed push complete')
          }
        }catch(e){ console.warn('Seed push attempt failed', e) }
      }catch(e){
          console.warn('API fetch failed, using seeded data', e)
        } finally {
          // Ensure UI can render (even if API failed) after the initial attempt
          try{ setDataSynced(true) }catch(_){}
        }
    }
    fetchAll()
  }, [])

  // Polling: periodically refresh activities from the server so that any
  // external changes made directly in the DB (or by other processes) are
  // reflected in the UI in near-real-time. Socket events still apply and
  // will typically be faster; this polling is a robust fallback to ensure
  // the activities page matches the DB when changes don't go through our
  // server socket path.
  useEffect(() => {
    if(!API_BASE) return; // no API configured

    let stopped = false
    const intervalMs = 3000

    async function pollOnce(){
      try{
        const base = API_BASE || ''
        const [aRes, cRes, uRes] = await Promise.allSettled([
          fetch(base + '/api/activities', withUserHeaders()),
          fetch(base + '/api/clients', withUserHeaders()),
          fetch(base + '/api/users', withUserHeaders())
        ])
        // activities
        if(aRes.status === 'fulfilled' && aRes.value.ok){
          const json = await aRes.value.json().catch(()=>null)
          const rows = Array.isArray(json) ? json : (json && Array.isArray((json as any).data) ? (json as any).data : [])
          if(Array.isArray(rows) && !stopped){
            setActivities(rows.map(normalizeActivityRow))
            setActivitiesSynced(true)
          }
        }
        // clients
        if(cRes.status === 'fulfilled' && cRes.value.ok){
          const json = await cRes.value.json().catch(()=>null)
          const rows = Array.isArray(json) ? json : (json && Array.isArray((json as any).data) ? (json as any).data : [])
          if(Array.isArray(rows) && !stopped){
            setClients(rows.map(normalizeClientRow))
          }
        }
        // users/team
        if(uRes.status === 'fulfilled' && uRes.value.ok){
          const json = await uRes.value.json().catch(()=>null)
          const rows = Array.isArray(json) ? json : (json && Array.isArray((json as any).data) ? (json as any).data : [])
          if(Array.isArray(rows) && !stopped){
            const mapped = rows.map(normalizeTeamRow)
            // Ensure authenticated user is present for stable identity; merge by id/email if not present
            if(isAuthenticated && authUser){
              const hasById = mapped.some(t => String(t.id) === String(authUser.id))
              const hasByEmail = authUser.email ? mapped.some(t => String((t.email||'')).toLowerCase() === String(authUser.email).toLowerCase()) : false
              if(!hasById && !hasByEmail){ mapped.unshift(authUser) }
            }
            setTeam(mapped)
          }
        }
      }catch(e){
        // ignore transient fetch errors; leave local state as-is
      }
    }

    // Start immediately, then on interval
    pollOnce()
    const id = setInterval(pollOnce, intervalMs)
    return () => { stopped = true; clearInterval(id) }
  }, [API_BASE])

  // Role based visibility helpers
  function getTeamMembersUnder(managerId: string){
    return team.filter(t => t.managerId === managerId).map(t => t.id)
  }

  function visibleClientIdsForUser(userId: string){
    const user = team.find(t => t.id === userId)
    if(!user) return []
    const roleLower = String((user as any).role || '').toLowerCase()
    if(roleLower === 'owner') return clients.map(c => c.id)
    if(roleLower === 'admin'){
      const adminTeam = String((user as any).team || '').toLowerCase()
      // If admin has All Markets, show all
      if(adminTeam.includes('all market')) return clients.map(c=>c.id)
      // Else admins see clients owned by users under their market OR who report to them
      const allowedOwnerIds = new Set<string>()
      team.forEach(tm => {
        const tRole = String((tm as any).role || '').toLowerCase()
        const tTeam = String((tm as any).team || '').toLowerCase()
        const isUserLevel = tRole === 'user' || tRole === 'bdm'
        const sameMarket = adminTeam && tTeam === adminTeam
        const reportsToAdmin = String((tm as any).managerId || '') === String(userId)
        if(isUserLevel && (sameMarket || reportsToAdmin)){
          allowedOwnerIds.add(String(tm.id))
        }
      })
      // Admin can also see their own
      allowedOwnerIds.add(String(userId))
      return clients.filter(c => allowedOwnerIds.has(String(c.ownerId))).map(c => c.id)
    }
    // Default: user-level sees only own clients
    return clients.filter(c => String(c.ownerId) === String(userId)).map(c => c.id)
  }

  function filteredClientsForUser(userId: string){
    const ids = visibleClientIdsForUser(userId)
    return clients.filter(c => ids.includes(c.id))
  }

  function filteredActivitiesForUser(userId: string){
    const user = team.find(t => t.id === userId)
    if(!user) return []
    const roleLower = String((user as any).role || '').toLowerCase()
    if(roleLower === 'owner') return activities
    const visibleClientIds = new Set(visibleClientIdsForUser(userId))
    if(roleLower === 'admin'){
      // Admin sees activities owned by allowed owners or tied to visible clients
      const adminTeam = String((user as any).team || '').toLowerCase()
      if(adminTeam.includes('all market')) return activities
      const allowedOwnerIds = new Set<string>()
      team.forEach(tm => {
        const tRole = String((tm as any).role || '').toLowerCase()
        const tTeam = String((tm as any).team || '').toLowerCase()
        const isUserLevel = tRole === 'user' || tRole === 'bdm'
        const sameMarket = adminTeam && tTeam === adminTeam
        const reportsToAdmin = String((tm as any).managerId || '') === String(userId)
        if(isUserLevel && (sameMarket || reportsToAdmin)) allowedOwnerIds.add(String(tm.id))
      })
      allowedOwnerIds.add(String(userId))
      return activities.filter(a => {
        const ownerIdRaw = a.ownerId ? String(a.ownerId) : ''
        if(allowedOwnerIds.has(ownerIdRaw)) return true
        if(a.clientId && visibleClientIds.has(String(a.clientId))) return true
        return false
      })
    }
    // User-level: own activities or activities for visible clients (own clients)
    return activities.filter(a => {
      const ownerIdRaw = a.ownerId ? String(a.ownerId) : ''
      if(ownerIdRaw === userId) return true
      if(a.clientId && visibleClientIds.has(String(a.clientId))) return true
      return false
    })
  }
  const [showSettingsSections, setShowSettingsSections] = useState<boolean>(false)
  const [selectedSettingsTab, setSelectedSettingsTab] = useState<string>('Organization')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!authUser)
  const [notifications, setNotifications] = useState<{ toId: string; message: string; timestamp: string; meta?: any; error?: string }[]>([])

  // demo current user (in a real app this would come from auth)
  const [currentUserId, setCurrentUserId] = useState<string>(() => (authUser?.id ? String(authUser.id) : 't-simo'))
  const currentUser = (team.find(t => String(t.id) === String(currentUserId)) || authUser || team[0] || ({} as TeamMember)) as TeamMember

  // During local development, default the bot API URL/key so the browser can send via the running local bot
  if(typeof window !== 'undefined'){
    try{
      if(!localStorage.getItem('BOT_API_URL')) localStorage.setItem('BOT_API_URL', 'http://127.0.0.1:3002')
      if(!localStorage.getItem('BOT_API_KEY')) localStorage.setItem('BOT_API_KEY', 'dev-secret')
    }catch(e){ /* ignore storage errors */ }
  }

  // allow runtime configuration of WhatsApp credentials (stored in localStorage)
  function setWhatsAppCredentials(token: string, phoneId: string){
    if(typeof window !== 'undefined'){
      localStorage.setItem('WHATSAPP_TOKEN', token)
      localStorage.setItem('WHATSAPP_PHONE_ID', phoneId)
    }
  }

  async function addClient(c: Omit<Client,'id'|'createdAt'|'updatedAt'>){
    const base = API_BASE || ''
    try{
  const res = await fetch(base + '/api/clients', withUserHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) }))
      if(!res.ok){
        const txt = await res.text().catch(()=>String(res.status))
        throw new Error('Failed to create client: ' + txt)
      }
      const created = await res.json()
      const row = created && created.data ? created.data : created
  // server will emit via socket; also update locally but avoid duplicate if socket already added it
  if(row) setClients(prev => prev.some(c => c.id === String(row.id)) ? prev : [normalizeClientRow(row), ...prev])
      // After creating the client, also create an initial onboarding activity on the server
      try{
        const ownerId = (row && (row.ownerId || row.owner_id)) || c.ownerId || currentUserId
        // include both camelCase and DB-oriented column names to maximize compatibility
        const sqlDatetime = new Date().toISOString().slice(0,19).replace('T',' ')

        const activityPayloadAny: any = {
          // camelCase (used by frontend API expectations)
          type: 'Task',
          title: `Onboard ${row.clientName || row.client_name || c.clientName}`,
          notes: 'Auto-created onboarding task',
          clientId: String(row.id),
          userId: ownerId,
          ownerId: ownerId,
          datetime: new Date().toISOString(),
          status: 'Planned',
          // snake_case / DB-specific fields (some column names are capitalized in your DB)
          client_id: String(row.id),
          Client: row.clientName || row.client_name || c.clientName || `Client ${row.id}`,
          Owner: team.find((t:any)=>t.id === ownerId)?.name || ownerId,
          Date: sqlDatetime,
          Title: `Onboard ${row.clientName || row.client_name || c.clientName}`,
          Type: 'Task',
          Status: 'Planned',
          Assignment: null
        }
        const actRes = await fetch(base + '/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activityPayloadAny) })
        if(actRes.ok){
          const actJson = await actRes.json().catch(()=>null)
          const actRow = actJson && actJson.data ? actJson.data : actJson
          if(actRow){ const na = normalizeActivityRow(actRow); setActivities(prev => prev.some(a => a.id === na.id) ? prev : [na as Activity, ...prev]) }
        } else {
          const txt = await actRes.text().catch(()=>String(actRes.status))
          console.warn('Failed to create onboarding activity:', txt)
        }
      }catch(err){
        console.warn('Onboarding activity creation failed', err)
      }

      return row as Client
    }catch(e){
      // fallback to local seed behavior when API not available
      const createdAt = new Date().toISOString()
      const clientPayload = { ...(c as any) }
      if(!clientPayload.status) clientPayload.status = 'Prospect'
      const client: Client = { ...clientPayload, id: 'c-'+uuid(), createdAt, updatedAt: createdAt }
      setClients(s => [client,...s])
      try{
        const onboarding: Omit<Activity,'id'> = {
          type: 'Task',
          title: `Onboard ${client.clientName}`,
          notes: 'Auto-created onboarding task',
          clientId: client.id,
          ownerId: client.ownerId,
          datetime: new Date().toISOString(),
          status: 'Planned'
        }
        setActivities(s => [{ ...onboarding, id: 'a-'+uuid() }, ...s])
      }catch(e){}
      return client
    }
  }
  
  async function updateActivity(id: string, patch: Partial<Activity>){
    const baseUrl = API_BASE || ''
    // Build an append-only snapshot by merging the existing activity with the patch
    const base = activities.find(a => a.id === id)
    const nowIso = new Date().toISOString()
    const nowSql = nowIso.slice(0,19).replace('T',' ')
    const merged: Activity = { ...(base as any), ...(patch as any) } as Activity
    // Resolve final status and map UI 'Canceled' to DB 'Cancelled'
    const statusMerged = (patch.status ?? base?.status ?? 'Planned') as Activity['status']
    const dbStatus = statusMerged === 'Canceled' ? 'Cancelled' : statusMerged

    // Special case: manager is setting a new cut-off for a Postponed activity that currently has no cut-off
    // Business rule: Create a NEW row with status Planned (append-only), keep the Postponed record intact
    if(patch.cut_off_date && base && base.status === 'Postponed' && !base.cut_off_date){
      const cutoffDateOnly = String(patch.cut_off_date).slice(0,10)
      const plannedStatus: Activity['status'] = 'Planned'
      // Derive identifiers and names
      const clientIdVal = base.clientId
      const ownerIdVal = base.ownerId || currentUserId
      const ownerName = team.find(t => String(t.id) === String(ownerIdVal))?.name || String(ownerIdVal || '')
      const clientName = clientIdVal ? (clients.find(c => String(c.id) === String(clientIdVal))?.clientName || '') : ''
      const nowIso2 = new Date().toISOString()
      const nowSql2 = nowIso2.slice(0,19).replace('T',' ')

      const activityPayloadAny: any = {
        // camelCase (frontend semantics)
        clientId: clientIdVal !== undefined ? clientIdVal : null,
        userId: ownerIdVal,
        ownerId: ownerIdVal,
        type: base.type || 'Task',
        title: base.title || 'Activity update',
        notes: base.notes ?? null,
        datetime: nowIso2,
        status: plannedStatus,
        assignment: base.assignment ?? null,
        cut_off_date: cutoffDateOnly,
        postpones_count: base.postpones_count || 0,
        // DB-oriented variants for broader compatibility
        client_id: clientIdVal !== undefined ? (typeof clientIdVal === 'string' && !Number.isNaN(Number(clientIdVal)) ? Math.trunc(Number(clientIdVal)) : clientIdVal) : null,
        Client: clientName,
        Owner: ownerName,
        Date: nowSql2,
        Title: base.title || 'Activity update',
        Type: base.type || 'Task',
        Status: plannedStatus,
        Assignment: base.assignment ?? null,
        'Cut-off': cutoffDateOnly,
        'Cut off': cutoffDateOnly,
        'Cut Off': cutoffDateOnly,
        'Cut off date': cutoffDateOnly,
        'Cut Off Date': cutoffDateOnly
      }

      try{
        if(typeof window !== 'undefined') console.debug('[updateActivity][POST] Postponed -> Planned with cut-off (append)', activityPayloadAny)
        const res = await fetch(baseUrl + '/api/activities', withUserHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activityPayloadAny) }))
        if(!res.ok){
          const txt = await res.text().catch(()=>String(res.status))
          if(typeof window !== 'undefined') console.debug('[updateActivity][POST][ERR]', txt)
          throw new Error('Failed to append planned activity: ' + txt)
        }
        const actJson = await res.json().catch(()=>null)
        if(typeof window !== 'undefined') console.debug('[updateActivity][POST][OK]', actJson)
        const actRow = actJson && actJson.data ? actJson.data : actJson
        if(actRow){
          const na = normalizeActivityRow(actRow) as Activity
          setActivities(prev => prev.some(a => String(a.id) === String((na as any).id)) ? prev : [na, ...prev])
          // Also sync client.next_followup in DB to this cutoff
          try{
            const clientIdVal = base?.clientId
            if(clientIdVal){
              const idPath = !Number.isNaN(Number(clientIdVal)) ? String(Number(clientIdVal)) : String(clientIdVal)
              const cutDateOnly = cutoffDateOnly ? String(cutoffDateOnly).slice(0,10) : null
              await fetch(baseUrl + '/api/clients/' + idPath, withUserHeaders({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_followup: cutDateOnly }) }))
              setClients(prev => prev.map(c => String(c.id) === String(clientIdVal) ? { ...c, nextFollowUpDate: cutDateOnly ? new Date(cutDateOnly).toISOString() : null } : c))
              // Business rule: when a new cut-off is set (moving from Postponed), client becomes In Progress
              const desiredStatus: Client['status'] = 'In Progress'
              try{
                await fetch(baseUrl + '/api/clients/' + idPath, withUserHeaders({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: desiredStatus, Status: desiredStatus }) }))
              }catch(_){ /* non-fatal */ }
              setClients(prev => prev.map(c => String(c.id) === String(clientIdVal) ? { ...c, status: desiredStatus } : c))
            }
          }catch(_){ /* ignore sync errors */ }
          return na
        }
        return null
      }catch(e){
        if(typeof window !== 'undefined') console.debug('[updateActivity][POST][CATCH]', e)
        // Local fallback: append a new snapshot row with status Planned and the new cut-off
        let result: Activity | null = null
        setActivities(prev => {
          const baseLocal = prev.find(a => a.id === id) || (base as any)
          if(!baseLocal) return prev
          const parentId = baseLocal.parentId || baseLocal.id
          const versions = prev.filter(a => (a.parentId || a.id) === parentId).map(a => a.version || 1)
          const nextVersion = Math.max(0, ...versions) + 1
          const newSnap: Activity = { ...baseLocal, id: 'a-'+uuid(), parentId, version: nextVersion, datetime: nowIso2, status: plannedStatus, cut_off_date: cutoffDateOnly, postpones_count: baseLocal.postpones_count || 0 }
          result = newSnap
          return [newSnap, ...prev]
        })
        return result
      }
    }

    // Determine fields for payload
    const clientIdVal = (merged && merged.clientId !== undefined) ? merged.clientId : (base?.clientId)
    const ownerIdVal = (merged && merged.ownerId !== undefined) ? merged.ownerId : (base?.ownerId || currentUserId)
    const ownerName = team.find(t => t.id === String(ownerIdVal))?.name || String(ownerIdVal || '')
    const clientName = clientIdVal ? (clients.find(c => String(c.id) === String(clientIdVal))?.clientName || '') : ''
    // handle postpone count
    const isTransitionToPostponed = (patch.status === 'Postponed') && (base ? base.status !== 'Postponed' : true)
    const newPostpones = (base?.postpones_count || 0) + (isTransitionToPostponed ? 1 : 0)

    // If a cut_off_date is being set on a previously Postponed item and status isn't explicitly provided,
    // keep status unchanged (UI decides). No extra special-casing needed here.

    // ensure date-only for DB `date` columns; if postponed, keep cut-off empty
    let cutoffDateOnly = merged.cut_off_date ? String(merged.cut_off_date).slice(0,10) : (base?.cut_off_date ? String(base?.cut_off_date).slice(0,10) : null)
    if(statusMerged === 'Postponed'){
      cutoffDateOnly = null
    }

  const activityPayloadAny: any = {
      // camelCase (frontend semantics)
      clientId: clientIdVal !== undefined ? clientIdVal : null,
      userId: ownerIdVal,
      ownerId: ownerIdVal,
      type: merged.type || base?.type || 'Task',
      title: merged.title || base?.title || 'Activity update',
      notes: merged.notes ?? base?.notes ?? null,
      datetime: nowIso,
  status: dbStatus,
      assignment: merged.assignment ?? base?.assignment ?? null,
  cut_off_date: cutoffDateOnly,
      postpones_count: newPostpones,
      // DB-oriented variants for broader compatibility
      client_id: clientIdVal !== undefined ? (typeof clientIdVal === 'string' && !Number.isNaN(Number(clientIdVal)) ? Math.trunc(Number(clientIdVal)) : clientIdVal) : null,
      Client: clientName,
      Owner: ownerName,
      Date: nowSql,
      Title: merged.title || base?.title || 'Activity update',
      Type: merged.type || base?.type || 'Task',
  Status: dbStatus,
      Assignment: merged.assignment ?? base?.assignment ?? null,
      'Cut-off': cutoffDateOnly,
      'Cut off': cutoffDateOnly,
      'Cut Off': cutoffDateOnly,
      'Cut off date': cutoffDateOnly,
      'Cut Off Date': cutoffDateOnly
    }

    try{
      if(typeof window !== 'undefined' && (statusMerged === 'Postponed' || statusMerged === 'Canceled')){
        console.debug('[updateActivity][POST] payload', activityPayloadAny)
      }
  const res = await fetch(baseUrl + '/api/activities', withUserHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activityPayloadAny) }))
      if(!res.ok){
        const txt = await res.text().catch(()=>String(res.status))
        if(typeof window !== 'undefined') console.debug('[updateActivity][POST][ERR]', txt)
        throw new Error('Failed to append activity: ' + txt)
      }
      const actJson = await res.json().catch(()=>null)
      if(typeof window !== 'undefined' && (statusMerged === 'Postponed' || statusMerged === 'Canceled')){
        console.debug('[updateActivity][POST][OK]', actJson)
      }
      const actRow = actJson && actJson.data ? actJson.data : actJson
      if(actRow){
        const na = normalizeActivityRow(actRow) as Activity
        // Avoid duplicate if socket already added it
        setActivities(prev => prev.some(a => String(a.id) === String((na as any).id)) ? prev : [na, ...prev])
        // Sync client.next_followup in DB to this cutoff
        try{
          const clientIdForSync: any = (typeof clientIdVal !== 'undefined' ? clientIdVal : (base?.clientId as any))
          if(clientIdForSync){
            const idPath = !Number.isNaN(Number(clientIdForSync)) ? String(Number(clientIdForSync)) : String(clientIdForSync)
            const cutDateOnlyStr = cutoffDateOnly ? String(cutoffDateOnly).slice(0,10) : null
            await fetch(baseUrl + '/api/clients/' + idPath, withUserHeaders({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_followup: cutDateOnlyStr }) }))
            setClients(prev => prev.map(c => String(c.id) === String(clientIdForSync) ? { ...c, nextFollowUpDate: cutDateOnlyStr ? new Date(cutDateOnlyStr).toISOString() : null } : c))

            // Also reflect activity status onto the client status in DB and locally
            let desiredStatus: Client['status'] | null = null
            if(patch && typeof patch.status !== 'undefined'){
              const s = String(patch.status) as Activity['status']
              if(s === 'Completed') desiredStatus = 'Completed'
              else if(s === 'Canceled') desiredStatus = 'Canceled'
              else if(s === 'In Progress') desiredStatus = 'In Progress'
              else if(s === 'Postponed') desiredStatus = 'Postponed'
            }
            // If a cut-off date is set and not postponed, treat client as In Progress
            if(!desiredStatus && patch && patch.cut_off_date && statusMerged !== 'Postponed'){
              desiredStatus = 'In Progress'
            }
            if(desiredStatus){
              try{
                await fetch(baseUrl + '/api/clients/' + idPath, withUserHeaders({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: desiredStatus, Status: desiredStatus }) }))
              }catch(_){ /* ignore */ }
              setClients(prev => prev.map(c => String(c.id) === String(clientIdForSync) ? { ...c, status: desiredStatus as Client['status'] } : c))
            }
          }
        }catch(_){ /* ignore sync errors */ }
        return na
      }
      return null
    }catch(e){
      if(typeof window !== 'undefined') console.debug('[updateActivity][POST][CATCH]', e)
      // fallback to local append-only snapshot when API not available
      let result: Activity | null = null

      setActivities(prev => {
        const baseLocal = prev.find(a => a.id === id) || (base as any)
        if(!baseLocal){ return prev }

        const parentId = baseLocal.parentId || baseLocal.id
        const versions = prev.filter(a => (a.parentId || a.id) === parentId).map(a => a.version || 1)
        const nextVersion = Math.max(0, ...versions) + 1

        const isTransition = (patch.status === 'Postponed') && baseLocal.status !== 'Postponed'
        const localPostpones = (baseLocal.postpones_count || 0) + (isTransition ? 1 : 0)

        // Special case: setting cut_off_date while currently postponed keeps same version in local history
        if(patch.cut_off_date && baseLocal.status === 'Postponed'){
          const sameVersion = baseLocal.version ?? 2
          const newSnap: Activity = { ...baseLocal, ...patch, id: 'a-' + uuid(), parentId, version: sameVersion, datetime: nowIso, postpones_count: baseLocal.postpones_count || 0 }
          result = newSnap
          return [newSnap, ...prev]
        }

        const newSnap: Activity = { ...baseLocal, ...patch, id: 'a-' + uuid(), parentId, version: nextVersion, datetime: nowIso, postpones_count: localPostpones }
        if(patch.status === 'Postponed') newSnap.cut_off_date = undefined
        result = newSnap
        return [newSnap, ...prev]
      })

      // Local-only: reflect next follow-up on client state (best effort)
      try{
        const clientIdVal = base?.clientId
        if(clientIdVal){
          const cutDateOnly = (patch.cut_off_date && patch.status !== 'Postponed') ? String(patch.cut_off_date).slice(0,10) : null
          setClients(prev => prev.map(c => String(c.id) === String(clientIdVal) ? { ...c, nextFollowUpDate: cutDateOnly ? new Date(cutDateOnly).toISOString() : null } : c))
        }
      }catch(_){ /* ignore */ }

      // Update client status locally when meaningful
      if(result && patch.cut_off_date){
        const createdClientId = (result as Activity).clientId
        if(createdClientId){
          setClients(clPrev => clPrev.map(cli => cli.id === createdClientId ? { ...cli, status: 'In Progress' } : cli))
        }
      }
      if(result && patch.status){
        const createdClientId = (result as Activity).clientId
        if(createdClientId){
          const mapStatus = (status: Activity['status']): Client['status'] | null => {
            if(status === 'Completed') return 'Completed'
            if(status === 'Canceled') return 'Canceled'
            if(status === 'In Progress') return 'In Progress'
            return null
          }
          const newClientStatus = mapStatus(patch.status as Activity['status'])
          if(newClientStatus){
            setClients(clPrev => clPrev.map(cli => cli.id === createdClientId ? { ...cli, status: newClientStatus } : cli))
          }
        }
      }

      return result
    }
  }
  
  // API-backed client update
  async function updateClient(id:string, patch: Partial<Client>){
    const base = API_BASE || ''
    try{
      // Some DBs use numeric PKs; if id is numeric-like, send as number in the path to avoid edge-case routers
      const idPath = !Number.isNaN(Number(id)) ? String(Number(id)) : String(id)
      const res = await fetch(base + '/api/clients/' + idPath, withUserHeaders({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }))
      if(!res.ok) throw new Error('Failed to update client')
      const updated = await res.json()
      const row = updated && updated.data ? updated.data : updated
      if(row){
        const mappedRow = (typeof normalizeClientRow === 'function') ? normalizeClientRow(row) : row
        const mappedClient = mappedRow as Client
  // Server socket will broadcast the updated client; UI will sync via socket/polling
        // Fire-and-forget: create an activity row for this client update (MVP)
        (async () => {
          try{
            const clientIdVal = row.id || mappedRow.id || id
            const clientIdNumeric = !Number.isNaN(Number(clientIdVal)) ? Number(clientIdVal) : String(clientIdVal)
            const clientName = (mappedRow && (mappedRow.clientName || (mappedRow as any).client_name)) || ''
            // Title logic for edit: assignment from patch, or nextMeetingDateTime -> 'Follow-up', else 'Client updated'
            const title = (patch as any).assignment ? String((patch as any).assignment).slice(0,255) : ((patch as any).nextMeetingDateTime ? 'Follow-up' : 'Client updated')
            const ownerIdVal = (mappedClient && ((mappedClient as any).ownerId || (mappedClient as any).owner_id)) || (patch as any).ownerId || currentUserId
            const ownerName = (team && team.find ? (team.find(t => t.id === ownerIdVal) || { name: undefined })?.name : undefined) || '(unassigned)'

            const activityPayloadAny: any = {
              // camelCase
              clientId: clientIdNumeric,
              type: 'Task',
              title,
              client: String(clientName),
              owner: String(ownerName),
              datetime: new Date().toISOString(),
              status: 'Planned',
              assignment: null,
              cut_off_date: null,
              // DB-oriented fields
              client_id: clientIdNumeric,
              Client: String(clientName || ''),
              Owner: String(ownerName || ''),
              Date: new Date().toISOString().slice(0,19).replace('T',' '),
              Title: title,
              Type: 'Task',
              Status: 'Planned',
              Assignment: null
            }

            const actRes = await fetch(base + '/api/activities', withUserHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activityPayloadAny) }))
            if(actRes.ok){
              const actJson = await actRes.json().catch(()=>null)
              const actRow = actJson && actJson.data ? actJson.data : actJson
              if(actRow){ const na = normalizeActivityRow(actRow); setActivities(prev => prev.some(a => String(a.id) === String(na.id)) ? prev : [na as Activity, ...prev]) }
            } else {
              const txt = await actRes.text().catch(()=>String(actRes.status))
              console.warn('Failed to create activity for client update:', txt)
            }
          }catch(err){
            console.warn('Activity creation (client update) failed', err)
          }
        })()
  return mappedClient as Client
      }
      return null
    }catch(err){
      if(typeof window !== 'undefined'){
        try{ console.warn('Client update failed, applying local fallback:', err) }catch{}
        try{ (window as any).__ELECTRIX_LAST_ERROR = String((err as any)?.message || err) }catch{}
      }
      // fallback to local mutation
      let result: Client | null = null
      setClients(prev => prev.map(c => {
        if(c.id !== id) return c
        result = { ...c, ...patch, updatedAt: new Date().toISOString() }
        return result
      }))
      // create local activity snapshot so Activities page reflects update even when API unavailable
      try{
        if(result){
          const client = result as Client
          const clientIdVal = client.id
          const clientName = client.clientName || ''
          const title = (patch as any).assignment ? String((patch as any).assignment).slice(0,255) : ((patch as any).nextMeetingDateTime ? 'Follow-up' : 'Client updated')
          const ownerIdVal = (client && ((client as any).ownerId || (patch as any).ownerId)) || currentUserId
          const ownerName = (team && team.find ? (team.find(t => t.id === ownerIdVal) || { name: undefined })?.name : undefined) || '(unassigned)'

          const onboarding: any = {
            type: 'Task',
            title,
            notes: 'Auto-created activity (local)',
            clientId: clientIdVal,
            ownerId: ownerIdVal,
            datetime: new Date().toISOString(),
            status: 'Planned',
            assignment: null,
            cut_off_date: null
          }
          // include DB-oriented fields for consistency with server schema
          onboarding.client_id = clientIdVal
          onboarding.Client = clientName
          onboarding.Owner = ownerName
          onboarding.Date = new Date().toISOString()
          onboarding.Title = title
          onboarding.Type = 'Task'
          onboarding.Status = 'Planned'
          onboarding.Assignment = null
          setActivities(prev => [{ ...onboarding, id: 'a-'+uuid() }, ...prev])
        }
      }catch(e){ console.warn('Local activity creation failed', e) }
      return result
    }
  }

  // API-backed client delete
  async function deleteClient(id:string){
    const base = API_BASE || ''
    try{
  const res = await fetch(base + '/api/clients/' + id, withUserHeaders({ method: 'DELETE' }))
      if(!res.ok) throw new Error('Failed to delete client')
      // server will emit via socket; also update locally
      setClients(prev => prev.filter(c => c.id !== id))
      return true
    }catch(err){
      // fallback to local delete
      setClients(prev => prev.filter(c => c.id !== id))
      return false
    }
  }
  // in-memory simulator for sending WhatsApp messages (no external network calls)
  async function sendWhatsApp(toPhone: string, message: string, opts?: { templateName?: string }){
    const timestamp = new Date().toISOString()
    // optimistic entry
    setNotifications(n => [{ toId: toPhone, message, timestamp }, ...n])

  // Prefer a local/cloud bot HTTP API if configured to avoid Facebook Cloud API token complexity
  const botApiUrl = typeof window !== 'undefined' ? (localStorage.getItem('BOT_API_URL') || (import.meta as any).env?.VITE_BOT_API_URL) : (import.meta as any).env?.VITE_BOT_API_URL
  const botApiKey = typeof window !== 'undefined' ? (localStorage.getItem('BOT_API_KEY') || (import.meta as any).env?.VITE_BOT_API_KEY) : (import.meta as any).env?.VITE_BOT_API_KEY
  if(botApiUrl){
    try{
      const endpoint = botApiUrl.replace(/\/$/, '') + '/send'
      const payload: any = { to: toPhone, message }
      const headers: any = { 'Content-Type': 'application/json' }
      if(botApiKey) headers.Authorization = `Bearer ${botApiKey}`
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) })
      const json = await res.json().catch(()=>null)
      setNotifications(n => [{ toId: toPhone, message, timestamp, meta: json }, ...n])
      // eslint-disable-next-line no-console
      console.log(`[WhatsApp Bot] Sent to ${toPhone} at ${timestamp}`, json)
      // Treat non-2xx or an error payload as a failure so callers (UI) can react
      if(!res.ok || (json && (json.error || json.ok === false))){
        const errMsg = (json && (json.error || JSON.stringify(json))) || `HTTP ${res.status}`
        // debug log full response
        if(typeof window !== 'undefined') console.debug('[WhatsApp Bot] send response', { status: res.status, body: json })
        // record and throw so UI shows failure
        setNotifications(n => [{ toId: toPhone, message, timestamp, error: String(errMsg) }, ...n])
        throw new Error(String(errMsg))
      }
      return json
    }catch(err:any){
      setNotifications(n => [{ toId: toPhone, message, timestamp, error: String(err) }, ...n])
      // eslint-disable-next-line no-console
      console.warn('WhatsApp Bot send failed', err)
      // rethrow so callers can catch and show UI errors; UI may fall back or show message
      throw err
    }
  }

  // fallback: simulated
  const simMeta = { simulated: true }
  setNotifications(n => [{ toId: toPhone, message, timestamp, meta: simMeta }, ...n])
  // eslint-disable-next-line no-console
  console.log(`[WhatsApp][SIM] ${timestamp} -> ${toPhone}: ${message}`)
  return { simulated: true }
  }
  
  // Helpers to safely read fields that may be capitalized in DB rows
  const getRole = (u?: any) => String(u?.role || u?.Role || '').toLowerCase()
  const getTeamName = (u?: any) => String(u?.team || u?.Team || '').toLowerCase()
  const getPhone = (u?: any) => String(u?.phone || u?.Phone || '').trim()
  const getEmail = (u?: any) => String(u?.email || u?.Email || '').trim()
  const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))
  // Helper: get admin emails for a team/market (e.g., 'saudi arabia', 'dubai sales')
  function getAdminEmailsForTeam(teamNameLower?: string){
    const t = String(teamNameLower || '').toLowerCase()
    if(!t) return [] as string[]
    return uniq(team
      .filter(u => getRole(u) === 'admin' && getTeamName(u) === t)
      .map(u => getEmail(u))
      .filter(e => e && !EXCLUDED_RECIPIENTS.emails.has(String(e).toLowerCase())))
  }
  const normalizePhone = (p: string) => {
    const s = (p || '').trim()
    if(!s) return s
    // if starts with 00 convert to +, else leave +E.164 or raw digits as-is
    if(s.startsWith('00')) return '+' + s.slice(2)
    return s
  }
  // Global exclusions: do not notify these recipients
  const EXCLUDED_RECIPIENTS = {
    names: new Set<string>(['christopher poon']),
    phones: new Set<string>(['+85261125665']),
    emails: new Set<string>(['christopher.poon@electrixspace.com'])
  }
  function isExcludedRecipient(user?: any, phone?: string){
    const nm = String(user?.name || '').toLowerCase().trim()
    const ph = normalizePhone(String(phone || ''))
    if(nm && EXCLUDED_RECIPIENTS.names.has(nm)) return true
    if(ph && EXCLUDED_RECIPIENTS.phones.has(ph)) return true
    return false
  }

  // Email sending via backend SMTP (nodemailer) on Heroku/your server
  const EMAIL_ENDPOINT_DEFAULT = 'https://careforce-contact-backend-47e3076b508c.herokuapp.com/contact'
  // Build a professional HTML email aligned with WhatsApp text
  function buildEmailHtml(subject: string, bodyText: string){
    // Convert text with newlines into simple HTML paragraphs, bold key emoji lines
    const esc = (s:string)=> s
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
    const lines = (bodyText || '').split('\n')
    const htmlLines = lines.map((ln) => {
      const trimmed = ln.trim()
      if(!trimmed) return '<br/>'
      let isLabel = false
      try{
        isLabel = new RegExp('^[\\u{1F300}-\\u{1FAFF}]|^[A-Za-z]+:', 'u').test(trimmed)
      }catch{ // environments without unicode flag support
        isLabel = /^[A-Za-z]+:/.test(trimmed)
      }
      return `<p style=\"margin:6px 0;\">${isLabel ? '<strong>' + esc(trimmed) + '</strong>' : esc(trimmed)}</p>`
    }).join('')
    const signature = `
      <hr style=\"border:none;border-top:1px solid #e5e7eb;margin:16px 0;\"/>
      <p style=\"margin:6px 0;color:#111827;\"><strong>ELECTRIX CRM</strong></p>
      <p style=\"margin:2px 0;color:#374151;\">This is an automated notification from ELECTRIX CRM.</p>
      <p style=\"margin:2px 0;color:#6b7280;\">© ${new Date().getFullYear()} Electrix Space</p>
    `
    return `
      <div style=\"font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111827;\">
        <h2 style=\"margin:0 0 12px 0;font-size:18px;\">${esc(subject)}</h2>
        ${htmlLines}
        ${signature}
      </div>
    `
  }

  async function sendEmailHeroku(toEmail: string | string[], toName: string, subject: string, text: string, cc?: string[]){
    if(!toEmail) return { ok: false, skipped: true }
    // Prefer our backend SMTP endpoint (try configured API_BASE, then relative /api in case of reverse proxy)
  const html = buildEmailHtml(subject, text)
  const smtpPayload = { to: toEmail, subject, text, html, from: undefined as any, cc }
    try{
      const candidates: string[] = []
      // Primary: configured API base (env or localStorage override)
      if(API_BASE){ candidates.push(String(API_BASE).replace(/\/$/, '') + '/api/email/send') }
      // Fallback A: optional VITE_FALLBACK_API_BASE (can be set in static hosting env)
      const FALLBACK = (import.meta as any).env?.VITE_FALLBACK_API_BASE || ''
      if(FALLBACK){ candidates.push(String(FALLBACK).replace(/\/$/, '') + '/api/email/send') }
      // Fallback B: meta tag <meta name="api-base" content="https://backend.example.com">
      try{
        if(typeof document !== 'undefined'){
          const meta = document.querySelector('meta[name="api-base"]') as HTMLMetaElement | null
          const m = meta?.content || ''
          if(m) candidates.push(String(m).replace(/\/$/, '') + '/api/email/send')
        }
      }catch{/* ignore */}
      // Fallback C: relative path for environments where a reverse proxy routes /api to backend
      candidates.push('/api/email/send')

      for(const url of candidates){
        try{
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(smtpPayload) })
          if(res.ok){ return { ok: true } }
          const t = await res.text().catch(()=>String(res.status))
          console.warn('[Email][SMTP] Failed', res.status, t, 'via', url)
        }catch(e){
          console.warn('[Email][SMTP] Error calling', url, e)
        }
      }
    }catch(err){
      console.warn('[Email][SMTP] Unexpected error (pre-fallback)', err)
    }

  // Fallback: legacy contact endpoint (form-like API)
    const endpoint = (function(){
      if(typeof window !== 'undefined'){
        const ls = localStorage.getItem('EMAIL_ENDPOINT')
        if(ls) return ls
      }
      const env = (import.meta as any).env?.VITE_EMAIL_ENDPOINT
      return env || EMAIL_ENDPOINT_DEFAULT
    })()
    // Legacy contact endpoint does not support CC; if multiple recipients are provided,
    // send one request per recipient to ensure delivery to all (corp + personal).
    const recipients: string[] = Array.isArray(toEmail) ? toEmail.filter(Boolean) : [toEmail].filter(Boolean)
    let allOk = true
    for(const toSingle of recipients){
      const message = `Subject: ${subject}\n\n${text}`
      const payload = {
        name: toName || 'ELECTRIX CRM',
        email: toSingle,
        message,
        website: '',
        contact_time: new Date().toISOString()
      }
      try{
        const hdrs: Record<string,string> = { 'Content-Type': 'application/json' }
        try{
          if(typeof window !== 'undefined'){
            hdrs['Origin'] = window.location.origin
            hdrs['Referer'] = window.location.href
          }
        }catch{}
        hdrs['User-Agent'] = 'ElectrixCRM/1.0 (+https://electrixspace.com)'
        let token = ''
        try{ if(typeof window !== 'undefined') token = localStorage.getItem('EMAIL_TOKEN') || '' }catch{}
        token = token || (import.meta as any).env?.VITE_EMAIL_TOKEN || ''
        if(token) hdrs['X-CRM-Token'] = token
        const res = await fetch(endpoint, { method: 'POST', headers: hdrs, body: JSON.stringify(payload) })
        const ok = res.ok
        if(!ok){
          const t = await res.text().catch(()=>String(res.status))
          console.warn('[Email][Legacy] Failed', res.status, t)
          allOk = false
        }
      }catch(err){
        console.warn('[Email][Legacy] Error', err)
        allOk = false
      }
    }
    return { ok: allOk }
  }

  // Global CC list for all outbound emails
  const CC_EMAILS_DEFAULT = ['simo.kouidi@electrixspace.com']

  // Fetch helpers (bypass RLS by omitting user headers intentionally for notifications routing only)
  async function fetchAllUsersNoRls(): Promise<TeamMember[]>{
    try{
      const base = API_BASE || ''
      const res = await fetch(base + '/api/users')
      if(!res.ok) return []
      const json = await res.json().catch(()=>null)
      const rows = Array.isArray(json) ? json : (json && Array.isArray((json as any).data) ? (json as any).data : [])
      return (rows || []).map(normalizeTeamRow) as TeamMember[]
    }catch{ return [] }
  }
  async function fetchUserByIdNoRls(id: string): Promise<TeamMember | null>{
    try{
      const base = API_BASE || ''
      const res = await fetch(base + '/api/users/' + encodeURIComponent(id))
      if(!res.ok) return null
      const json = await res.json().catch(()=>null)
      const row = (json && (json as any).data) ? (json as any).data : json
      return row ? (normalizeTeamRow(row) as TeamMember) : null
    }catch{ return null }
  }
  async function resolveUserByIdOrName(key: string): Promise<TeamMember | null>{
    if(!key) return null
    // Try local team first (id match)
    let u = team.find(t => String(t.id) === String(key)) || null
    if(u) return u
    // Try name match (case-insensitive)
    u = team.find(t => String((t.name||'')).toLowerCase() === String(key).toLowerCase()) || null
    if(u) return u
    // Fallback to full list without RLS
    const all = await fetchAllUsersNoRls()
    const byId = all.find(t => String(t.id) === String(key))
    if(byId) return byId
    const byName = all.find(t => String((t.name||'')).toLowerCase() === String(key).toLowerCase())
    return byName || null
  }

  // Format helpers for notifications per requirements
  async function notifyStatusChange(activity: Activity, changerId: string, note: string){
    const changerUser = team.find(t=>String(t.id) === String(changerId))
    const changer = changerUser?.name || 'Unknown'
    const changerTeam = getTeamName(changerUser)
    const clientName = activity.clientId ? (clients.find(c=>c.id===activity.clientId)?.clientName || '—') : '—'
    const when = new Date().toISOString().slice(0,16).replace('T',' ')
    const lines = [
      '📌 Client Status Updated',
      `👤 Changed by: ${changer}`,
      `🏢 Client: ${clientName}`,
      `📊 New Status: ${activity.status}`,
      `🗓 Date: ${when}`,
      `📝 Note: "${note || ''}"`
    ]
    const message = lines.join('\n')

    // Recipients: direct manager (if any, else admin in same market), plus all Owners
    let ownersUsers = team.filter(t => getRole(t) === 'owner' && !isExcludedRecipient(t, getPhone(t)))
    if(ownersUsers.length === 0){
      const all = await fetchAllUsersNoRls()
      ownersUsers = all.filter(t => getRole(t) === 'owner' && !isExcludedRecipient(t, getPhone(t)))
    }
    // Prefer explicit managerId hop if present
    let managerUser: TeamMember | null = null
    if(changerUser?.managerId){
      const local = team.find(t => String(t.id) === String(changerUser?.managerId)) || null
      if(local && !isExcludedRecipient(local, getPhone(local))) managerUser = local
      if(!managerUser){
        const remote = await fetchUserByIdNoRls(String(changerUser.managerId))
        if(remote && !isExcludedRecipient(remote, getPhone(remote))) managerUser = remote
      }
    }
    // Fallback: Admin in same market/team
    if(!managerUser && changerTeam){
      let sameMarketAdmin = team.find(t => getRole(t) === 'admin' && getTeamName(t) === changerTeam) || null
      if(!sameMarketAdmin){
        const all = await fetchAllUsersNoRls()
        sameMarketAdmin = all.find(t => getRole(t) === 'admin' && getTeamName(t) === changerTeam) || null
      }
      if(sameMarketAdmin && !isExcludedRecipient(sameMarketAdmin, getPhone(sameMarketAdmin))) managerUser = sameMarketAdmin
    }

    // WhatsApp: send to phones
    const phones = uniq([
      managerUser ? normalizePhone(getPhone(managerUser)) : '',
      ...ownersUsers.map(u => normalizePhone(getPhone(u)))
    ]).filter(ph => ph && !EXCLUDED_RECIPIENTS.phones.has(ph))
    if(typeof window !== 'undefined') console.debug('[NotifyStatus] Recipients (phones):', phones)
    for(const ph of phones){
      if(!ph) continue
      try{ await sendWhatsApp(ph, message) }catch(err){ if(typeof window !== 'undefined') console.warn('[NotifyStatus] WhatsApp send failed (continue with email):', err) }
      if(activity.status === 'Postponed'){
        const extra = '\n\n⚠️ Action required: Please discuss with BDM to set a new cut-off date.'
        try{ await sendWhatsApp(ph, message + extra) }catch(err){ if(typeof window !== 'undefined') console.warn('[NotifyStatus] WhatsApp extra send failed:', err) }
      }
    }

    // Email: send to emails via Heroku endpoint
    const emailUsers = [managerUser, ...ownersUsers].filter(Boolean) as TeamMember[]
    const corpEmails = emailUsers.map(u => getEmail(u)).filter(e => e && !EXCLUDED_RECIPIENTS.emails.has(String(e).toLowerCase()))
    const personalEmails = emailUsers.map(u => String((u as any).personalEmail || '')).filter(e => e && !EXCLUDED_RECIPIENTS.emails.has(String(e).toLowerCase()))
    const toList = uniq([...corpEmails, ...personalEmails])
    if(toList.length){
      // CC defaults and market admins as organizational visibility
      const ccSet = new Set<string>()
      CC_EMAILS_DEFAULT.forEach(cc => ccSet.add(cc))
      if(changerTeam){ getAdminEmailsForTeam(changerTeam).forEach(e => ccSet.add(e)) }
      const ccList = Array.from(ccSet)
      const subject = 'ELECTRIX CRM — Client Status Updated'
      const textExtra = activity.status === 'Postponed' ? '\n\nAction required: Please discuss with BDM to set a new cut-off date.' : ''
      const text = message + textExtra + '\n\nThis is an automated notification from ELECTRIX CRM.'
      await sendEmailHeroku(toList, 'Recipients', subject, text, ccList)
    }
  }

  async function notifyAssignment(activity: Activity, assignedToId: string, managerId: string, note: string){
    const managerName = team.find(t=>String(t.id)===String(managerId))?.name || 'Manager'
    const assignee = team.find(t=>String(t.id)===String(assignedToId))
    // ownerId might be an id or a name depending on DB export; resolve robustly
    const ownerKey = String(activity.ownerId || '')
    let ownerUser = await resolveUserByIdOrName(ownerKey)
    // If still missing, attempt to use assignee as fallback if assignment equals a user id
    if(!ownerUser && assignee){ ownerUser = assignee }
    const ownerPhone = normalizePhone(getPhone(ownerUser))
    const clientName = activity.clientId ? (clients.find(c=>c.id===activity.clientId)?.clientName || '—') : '—'
    const when = new Date().toISOString().slice(0,16).replace('T',' ')
    const lines = [
      '✅ New Task Assigned',
      `👤 Assigned by: ${managerName}`,
      `👥 Assigned to: ${assignee?.name || ownerUser?.name || '—'}`,
      `🏢 Client: ${clientName}`,
      `📋 Task: ${activity.title}`,
      `🗓 Date: ${when}`,
      `📝 Note: "${note || ''}"`
    ]
    const message = lines.join('\n')

    // Recipient: activity owner phone as requested
    const recipient = ownerPhone
    if(typeof window !== 'undefined') console.debug('[NotifyAssign] Recipient:', recipient, 'Assigned to', assignee?.name)
    try{
      if(recipient){ await sendWhatsApp(recipient, message) }
    }catch(err){
      if(typeof window !== 'undefined') console.warn('[NotifyAssign] WhatsApp send failed, continuing with email', err)
    }
    // Email to owner as well
    const ownerEmail = getEmail(ownerUser)
    const ownerPersonal = String((ownerUser as any)?.personalEmail || '')
    const toList = uniq([ownerEmail, ownerPersonal].filter(Boolean))
    if(toList.length && (!ownerEmail || !EXCLUDED_RECIPIENTS.emails.has(ownerEmail.toLowerCase()))){
      const subject = 'ELECTRIX CRM — New Task Assigned'
      const text = message + '\n\nPlease log in to ELECTRIX CRM to review and take action.'
      // CC Simo (and any defaults) rather than sending separate emails
  const ccSet = new Set<string>()
  CC_EMAILS_DEFAULT.forEach(cc => ccSet.add(cc))
  // CC admin(s) of the assignee's team/market as well, if known
  const assigneeTeam = getTeamName(assignee || ownerUser)
  if(assigneeTeam){ getAdminEmailsForTeam(assigneeTeam).forEach(e => ccSet.add(e)) }
      // CC the manager as well (ensure not duplicating the primary To)
      try{
        let managerUser: TeamMember | null = team.find(t => String(t.id) === String(managerId)) || null
        if(!managerUser){ managerUser = await fetchUserByIdNoRls(String(managerId)) }
        const mEmail = managerUser ? getEmail(managerUser) : ''
        const mPersonal = managerUser ? String((managerUser as any).personalEmail || '') : ''
        if(mEmail && (!ownerEmail || mEmail.toLowerCase() !== ownerEmail.toLowerCase()) && !EXCLUDED_RECIPIENTS.emails.has(mEmail.toLowerCase())) ccSet.add(mEmail)
        if(mPersonal && (!ownerPersonal || mPersonal.toLowerCase() !== ownerPersonal.toLowerCase()) && !EXCLUDED_RECIPIENTS.emails.has(mPersonal.toLowerCase())) ccSet.add(mPersonal)
      }catch{ /* ignore manager lookup issues */ }
      const ccList = Array.from(ccSet)
      const name = (ownerUser?.name) || 'Recipient'
      await sendEmailHeroku(toList, name, subject, text, ccList)
    }
  }
  
  function addActivity(a: Omit<Activity,'id'>){
    const id = 'a-'+uuid()
    const act: Activity = { ...a, id, parentId: id, version: 1 }
    setActivities(s => [act, ...s])
  }
  function reset(){ setClients(seedClients); setActivities(seedActivities) }

  // basic prototype auth: username === email, password === family name (case-insensitive)
  async function login(username: string, password: string){
    if(!username) return false
    const base = API_BASE || ''
    // Dev-only quick bypass: ensure Admin/Admin can log in immediately in local dev
    const devMode = (import.meta as any).env?.VITE_DEV_MODE === 'true' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    // Dev-only bypass credentials (local testing):
    // Username can be one of: 'Admin', 'Admin@local', or 'Electrix2025'
    // Password must be the strong value below.
    const DEV_BYPASS_PASSWORD = 'ElectrixData2025@CRMv0.1'
    const allowedDevUsers = ['Admin', 'Admin@local', 'Electrix2025']
    if(devMode && allowedDevUsers.some(u => String(username||'').toLowerCase() === u.toLowerCase()) && password === DEV_BYPASS_PASSWORD){
      const user = { id: 'u-admin', name: 'Admin', email: 'Admin@local', role: 'Admin' }
      setTeam(prev => { const exists = prev.find(p=>p.id===user.id); if(exists) return prev.map(p=>p.id===user.id?user:p); return [user, ...prev] })
      setIsAuthenticated(true)
      setCurrentUserId(user.id)
      return true
    }
    // Try server-side authentication first
    try{
  const res = await fetch(base + '/api/auth/login', withUserHeaders({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }))
      if(res.ok){
        const json = await res.json()
        // server returns { user, token? }
        const user = json.user
        if(user && user.id){
          // update local team list (ensure user present)
          setTeam(prev => {
            // avoid duplicates
            const exists = prev.find(p => p.id === user.id)
            if(exists) return prev.map(p => p.id === user.id ? user : p)
            return [user, ...prev]
          })
          // Persist auth user and set state
          try{ if(typeof window !== 'undefined') localStorage.setItem('AUTH_USER', JSON.stringify(user)) }catch{}
          setAuthUser(user)
          setIsAuthenticated(true)
          setCurrentUserId(user.id)
          return true
        }
      }else{
        // non-200: treat as failure and fall through to local check
        console.warn('Auth API responded with', res.status)
      }
    }catch(err){
      console.warn('Auth API failed', err)
    }

    // Fallback to local/team-based auth when API is unavailable
    const found = team.find(t => (t.email || '').toLowerCase() === (username || '').toLowerCase())
    if(!found) return false
    // compare password case-insensitively; stored passwords are the family names per request
    if(found.password && found.password.toLowerCase() === (password || '').toLowerCase()){
      // Persist and set auth user
      const userData: TeamMember = { ...found }
      try{ if(typeof window !== 'undefined') localStorage.setItem('AUTH_USER', JSON.stringify(userData)) }catch{}
      setAuthUser(userData)
      setIsAuthenticated(true)
      // set current user to the authenticated user
      setCurrentUserId(found.id)
      return true
    }
    return false
  }

  function logout(){
    setIsAuthenticated(false)
    setAuthUser(null)
    try{ if(typeof window !== 'undefined') localStorage.removeItem('AUTH_USER') }catch{}
  }

  const value = useMemo(()=>({
    team,
    // expose filtered views based on currentUser
    clients: filteredClientsForUser(currentUserId),
    activities: filteredActivitiesForUser(currentUserId),
    authUser,
    currentUserId,
    currentUser,
    setCurrentUserId,
    showSettingsSections,
    setShowSettingsSections,
    selectedSettingsTab,
    setSelectedSettingsTab,
    addClient,
    updateClient,
    deleteClient,
    addActivity,
    updateActivity,
    reset,
    isAuthenticated,
    login,
    logout,
    sendWhatsApp,
    notifyStatusChange,
    notifyAssignment,
    setWhatsAppCredentials,
    notifications
    ,
    activitiesSynced
    ,
    dataSynced
  }), [team, clients, activities, currentUserId, showSettingsSections, selectedSettingsTab, isAuthenticated, notifications, authUser])
  // Expose test helpers in the browser window for convenience during testing
  if(typeof window !== 'undefined'){
    ;(window as any).__CRM_TEST_NOTIFY = {
      notifyStatusChange: async (activityId: string, note: string) => {
        const act = activities.find(a=>a.id===activityId)
        if(!act) return 'no-activity'
        await notifyStatusChange(act, currentUserId, note)
        return 'sent'
      },
      notifyAssignment: async (activityId: string, assigneeId: string, note: string) => {
        const act = activities.find(a=>a.id===activityId)
        if(!act) return 'no-activity'
        await notifyAssignment(act, assigneeId, currentUserId, note)
        return 'sent'
      }
    }
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(){
  const s = useContext(StoreContext)
  if(!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

export function useKPIs(){
  const { activities, clients } = useStore()
  const meetingsBooked = activities.filter(a=>a.type==='Meeting').length
  const dealsWon = activities.filter(a=>a.type==='Deal' && a.status==='Completed').length
  const followUpsDue = activities.filter(a=>a.type==='Follow-up' && new Date(a.datetime) > new Date()).length
  const thirtyDaysAgo = new Date(Date.now()-30*24*60*60*1000)
  const newProspects = clients.filter(c=> (c.status==='Planned' || c.status==='In Progress') && new Date(c.createdAt || '') > thirtyDaysAgo).length
  return { meetingsBooked, dealsWon, followUpsDue, newProspects }
}
