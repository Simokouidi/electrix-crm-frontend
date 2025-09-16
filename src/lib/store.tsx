import React, { createContext, useContext, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'

export type TeamMember = { id: string; name: string; email?: string; avatarUrl?: string; role?: string; phone?: string; password?: string; managerId?: string }
export type CompanySize = '1-50'|'51-200'|'201-1000'|'1001+'
export type PipelineStage = 'Discovery'|'Qualifying'|'ProposalSent'|'Negotiation'|'Contracting'|'Live'
export type Status = 'Planned'|'In Progress'|'Completed'|'Canceled'|'Postponed'
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
export type Activity = { id: string; parentId?: string; version?: number; type: 'Meeting'|'Task'|'Deal'|'Follow-up'; title: string; notes?: string; clientId?: string; ownerId: string; datetime: string; status: 'Planned'|'In Progress'|'Completed'|'Canceled'|'Postponed'; assignment?: string; cut_off_date?: string | null; postpones_count?: number; postponedBy?: string | null }

const now = new Date()
const daysAgo = (d:number)=> new Date(Date.now()-d*24*60*60*1000).toISOString()

const seedTeam: TeamMember[] = [
  { id: 't-simo', name: 'Simo Kouidi', email: 'Simo.kouidi@electrixspace.com', role: 'Admin', phone: '', password: 'Kouidi' },
  { id: 't-andrea', name: 'Andrea Di Palma', email: 'andrea.dipalma@electrixspace.com', role: 'Admin', phone: '', password: 'Dipalma' },
  { id: 't-mohammad', name: 'Mohammad Jazzar', email: 'Mohammad.Jazzar@electrixspace.com', role: 'Admin', phone: '', password: 'Jazzar' },
  { id: 't-youssef', name: 'Youssef Boussetta', email: 'Youssef.boussetta@electrixspace.com', role: 'BDM', phone: '', password: 'Boussetta', managerId: 't-mohammad' },
  { id: 't-mwasim', name: 'Mohammed Wasim', email: 'Mohammed.Wasim@electrixspace.com', role: 'BDM', phone: '', password: 'Wasim', managerId: 't-mohammad' },
  { id: 't-mali', name: 'Mohammed Ali', email: 'Mohammed.Ali@electrixspace.com', role: 'BDM', phone: '', password: 'Ali', managerId: 't-mohammad' },
  { id: 't-eslam', name: 'Eslam El Malah', email: 'Eslam.elmalah@electrixspace.com', role: 'BDM', phone: '', password: 'Elmalah', managerId: 't-mohammad' },
  { id: 't-arman', name: 'Arman Aras', email: 'Arman.Aras@electrixspace.com', role: 'BDM', phone: '', password: 'Aras' },
  { id: 't-abdulfattah', name: 'Abdulfattah Aljamal', email: 'Abdulfattah.aljamal@electrixspace.com', role: 'BDM', phone: '', password: 'Aljamal', managerId: 't-mohammad' },
  { id: 't-sami', name: 'Sami Alsawaftah', email: 'Sami.alsawaftah@electrixspace.com', role: 'BDM', phone: '', password: 'Alsawaftah', managerId: 't-mohammad' },
  { id: 't-chris', name: 'Christopher Poon', email: 'Christopher.poon@electrixspace.com', role: 'Manager', phone: '', password: 'Poon' },
  { id: 't-electrix', name: 'ELECTRIX', email: 'careforce@electrixspace.com', role: 'Service', phone: '', password: 'Careforce' },
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
  currentUserId: string
  currentUser: TeamMember
  setCurrentUserId?: (id: string) => void
  showSettingsSections: boolean
  setShowSettingsSections: React.Dispatch<React.SetStateAction<boolean>>
  selectedSettingsTab: string
  setSelectedSettingsTab: React.Dispatch<React.SetStateAction<string>>
  addClient: (c: Omit<Client,'id'|'createdAt'|'updatedAt'>) => Client
  updateClient: (id:string, patch: Partial<Client>) => Client | null
  deleteClient: (id:string)=>void
  addActivity: (a: Omit<Activity,'id'>)=>void
  updateActivity: (id: string, patch: Partial<Activity>) => Activity | null
  reset: ()=>void
  // auth (simple in-memory for prototype)
  isAuthenticated: boolean
  login: (username: string, password: string) => boolean
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
  const [team] = useState<TeamMember[]>(seedTeam)
  const [clients,setClients] = useState<Client[]>(seedClients)
  const [activities,setActivities] = useState<Activity[]>(seedActivities)

  // Role based visibility helpers
  function getTeamMembersUnder(managerId: string){
    return team.filter(t => t.managerId === managerId).map(t => t.id)
  }

  function visibleClientIdsForUser(userId: string){
    const user = team.find(t => t.id === userId)
    if(!user) return []
    // Admins see all
    if(user.role === 'Admin') return clients.map(c => c.id)
    // Managers (e.g., Mohammad) see their team's plus their own
    const teamMemberIds = getTeamMembersUnder(userId)
    const visible = new Set<string>([userId, ...teamMemberIds])
    return clients.filter(c => visible.has(c.ownerId)).map(c => c.id)
  }

  function filteredClientsForUser(userId: string){
    const ids = visibleClientIdsForUser(userId)
    return clients.filter(c => ids.includes(c.id))
  }

  function filteredActivitiesForUser(userId: string){
    const visibleClientIds = new Set(visibleClientIdsForUser(userId))
    // include activities where owner is user or activity.clientId is visible
    return activities.filter(a => a.ownerId === userId || (a.clientId && visibleClientIds.has(a.clientId)))
  }
  const [showSettingsSections, setShowSettingsSections] = useState<boolean>(false)
  const [selectedSettingsTab, setSelectedSettingsTab] = useState<string>('Organization')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [notifications, setNotifications] = useState<{ toId: string; message: string; timestamp: string }[]>([])

  // demo current user (in a real app this would come from auth)
  const [currentUserId, setCurrentUserId] = useState<string>('t-simo')
  const currentUser = team.find(t => t.id === currentUserId) || team[0]

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

  function addClient(c: Omit<Client,'id'|'createdAt'|'updatedAt'>){
    const createdAt = new Date().toISOString()
    const clientPayload = { ...(c as any) }
    // ensure default status is Prospect
    if(!clientPayload.status) clientPayload.status = 'Prospect'
    const client: Client = { ...clientPayload, id: 'c-'+uuid(), createdAt, updatedAt: createdAt }
    setClients(s => [client,...s])

    // automatically create an initial onboarding activity for the owner
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
    }catch(e){ /* ignore */ }

    return client
  }
  
  function updateActivity(id: string, patch: Partial<Activity>){
    let result: Activity | null = null

    setActivities(prev => {
      const base = prev.find(a => a.id === id)
      if(!base) return prev

      const parentId = base.parentId || base.id
      const versions = prev.filter(a => (a.parentId || a.id) === parentId).map(a => a.version || 1)
      const nextVersion = Math.max(0, ...versions) + 1

      // business rules: when transitioning to Postponed increment postpones_count and clear cut_off_date
      const isTransitionToPostponed = patch.status === 'Postponed' && base.status !== 'Postponed'
      const newPostpones = (base.postpones_count || 0) + (isTransitionToPostponed ? 1 : 0)

      // If assigning a cut_off_date to an already-Postponed snapshot, create a new snapshot row
      // but keep the same version number as the postponed snapshot (Option B)
      if(patch.cut_off_date && base.status === 'Postponed'){
        const sameVersion = base.version ?? 2
        const newSnap: Activity = { ...base, ...patch, id: 'a-' + uuid(), parentId, version: sameVersion, datetime: new Date().toISOString(), postpones_count: base.postpones_count || 0 }
        result = newSnap
        return [newSnap, ...prev]
      }

      // Otherwise create a new snapshot row (this happens when transitioning to Postponed or other edits)
      const merged: Activity = { ...base, ...patch, id: 'a-' + uuid(), parentId, version: nextVersion, datetime: new Date().toISOString(), postpones_count: newPostpones }
      // if setting Postponed, ensure canonical cut_off_date is cleared
      if(patch.status === 'Postponed') merged.cut_off_date = undefined
      result = merged
      return [merged, ...prev]
    })

    // if a cut_off_date was assigned (either in-place or via new snapshot) we may want to reactivate the client
    if(result && patch.cut_off_date){
      const createdClientId = (result as Activity).clientId
      if(createdClientId){
        setClients(clPrev => clPrev.map(cli => cli.id === createdClientId ? { ...cli, status: 'In Progress' } : cli))
      }
    }

    // if status changed and we created/updated an activity, update client status mapping
    if(result && patch.status){
      const createdClientId = (result as Activity).clientId
      if(!createdClientId) return result
      const map = (status: Activity['status']): Client['status'] | null => {
        if(status === 'Completed') return 'Completed'
        if(status === 'Canceled') return 'Canceled'
        if(status === 'In Progress') return 'In Progress'
        return null
      }
      const newClientStatus = map(patch.status as Activity['status'])
      if(newClientStatus){
        setClients(clPrev => clPrev.map(cli => cli.id === createdClientId ? { ...cli, status: newClientStatus } : cli))
      }
    }

    return result
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
  
  // Format helpers for notifications per requirements
  async function notifyStatusChange(activity: Activity, changerId: string, note: string){
    const changer = team.find(t=>t.id === changerId)?.name || 'Unknown'
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

  // During testing all notifications should go to the manager test number provided
  const TEST_RECIPIENT = '+85262392890'
  // Debug: log the bot API info so browser console shows what will be used
  if(typeof window !== 'undefined') console.debug('[NotifyStatus] Sending to', TEST_RECIPIENT)
  // Send the formatted notification
  await sendWhatsApp(TEST_RECIPIENT, message)
    // If postponed, send additional action-required message including the same details
    if(activity.status === 'Postponed'){
      const extra = '\n\n⚠️ Action required: Please discuss with BDM to set a new cut-off date.'
      await sendWhatsApp(TEST_RECIPIENT, message + extra)
    }
  }

  async function notifyAssignment(activity: Activity, assignedToId: string, managerId: string, note: string){
    const manager = team.find(t=>t.id===managerId)?.name || 'Manager'
    const assignee = team.find(t=>t.id===assignedToId)
    const assigneePhone = assignee?.phone
    const clientName = activity.clientId ? (clients.find(c=>c.id===activity.clientId)?.clientName || '—') : '—'
    const when = new Date().toISOString().slice(0,16).replace('T',' ')
    const lines = [
      '✅ New Task Assigned',
      `👤 Assigned by: ${manager}`,
      `👥 Assigned to: ${assignee?.name || '—'}`,
      `🏢 Client: ${clientName}`,
      `📋 Task: ${activity.title}`,
      `🗓 Date: ${when}`,
      `📝 Note: "${note || ''}"`
    ]
    const message = lines.join('\n')
  const TEST_RECIPIENT = '+85262392890'
  if(typeof window !== 'undefined') console.debug('[NotifyAssign] Sending to', TEST_RECIPIENT, 'Assigned to', assignee?.name)
  await sendWhatsApp(TEST_RECIPIENT, message)
  }
  function updateClient(id:string, patch: Partial<Client>){
    let updated: Client | null = null
    setClients(s => s.map(cli => {
      if(cli.id !== id) return cli
      updated = { ...cli, ...patch, updatedAt: new Date().toISOString() }
      return updated
    }))
    return updated
  }
  function deleteClient(id:string){ setClients(s => s.filter(x=>x.id!==id)) }
  function addActivity(a: Omit<Activity,'id'>){
    const id = 'a-'+uuid()
    const act: Activity = { ...a, id, parentId: id, version: 1 }
    setActivities(s => [act, ...s])
  }
  function reset(){ setClients(seedClients); setActivities(seedActivities) }

  // basic prototype auth: username === email, password === family name (case-insensitive)
  function login(username: string, password: string){
    if(!username) return false
    const found = team.find(t => (t.email || '').toLowerCase() === (username || '').toLowerCase())
    if(!found) return false
    // compare password case-insensitively; stored passwords are the family names per request
    if(found.password && found.password.toLowerCase() === (password || '').toLowerCase()){
      setIsAuthenticated(true)
      // set current user to the authenticated user
      setCurrentUserId(found.id)
      return true
    }
    return false
  }

  function logout(){ setIsAuthenticated(false) }

  const value = useMemo(()=>({
    team,
    // expose filtered views based on currentUser
    clients: filteredClientsForUser(currentUserId),
    activities: filteredActivitiesForUser(currentUserId),
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
  }), [team, clients, activities, currentUserId, showSettingsSections, selectedSettingsTab, isAuthenticated, notifications])
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
