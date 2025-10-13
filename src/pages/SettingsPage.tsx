import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import Button from '../components/Button'
import Logo from '../Images/Logo_copy2.png'
import { Eye, EyeOff, Key, Globe, Mail, Clock, Building2, MapPin, Shield, Users as UsersIcon, Settings as SettingsIcon, Edit3, Pencil, Trash2, Search, Lock } from 'lucide-react'
import { getAllowedSettingsTabs } from '../lib/settingsTabs'
// Crypto-safe password generation
function generateSecurePassword(len = 12){
  // ensure mix of upper, lower, digits, symbols; no hardcoding of outputs
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // omit easily confused I/O
  const lower = 'abcdefghijkmnopqrstuvwxyz' // omit l
  const digits = '23456789' // omit 0/1
  const symbols = '!@#$%^&*()-_=+[]{};:,.?'
  const sets = [upper, lower, digits, symbols]
  const all = sets.join('')
  const out: string[] = []
  // at least one from each set
  for(const s of sets){ out.push(s[Math.floor(Math.random()*s.length)]) }
  // fill rest using crypto if available
  const need = Math.max(0, len - out.length)
  if((window as any).crypto?.getRandomValues){
    const buf = new Uint32Array(need)
    ;(window as any).crypto.getRandomValues(buf)
    for(let i=0;i<need;i++){ out.push(all[buf[i] % all.length]) }
  } else {
    for(let i=0;i<need;i++){ out.push(all[Math.floor(Math.random()*all.length)]) }
  }
  // shuffle
  for(let i=out.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [out[i], out[j]] = [out[j], out[i]] }
  return out.join('')
}

const TABS = [
  'Organization', 'Users & Access', 'Pipelines', 'Routing & SLAs', 'Sequences', 'Messaging & Calendars', 'Notifications', 'Data', 'Automation', 'Audit & Security', 'Billing', 'Environments'
]

export default function SettingsPage(){
  const { team, reset, selectedSettingsTab, setSelectedSettingsTab, currentUser } = useStore()
  const roleLower = String(currentUser?.role || '').toLowerCase()
  const allowedTabs = useMemo(() => getAllowedSettingsTabs(roleLower), [roleLower])
  // Ensure the selected tab is one of the allowed tabs for this role
  const tab = allowedTabs.includes(selectedSettingsTab as any) ? selectedSettingsTab : allowedTabs[0]
  useEffect(() => {
    if(!allowedTabs.includes(selectedSettingsTab as any) && allowedTabs[0]){
      setSelectedSettingsTab(allowedTabs[0])
    }
  }, [allowedTabs.join('|')])

  const [detected, setDetected] = useState<{ timezone?: string, country?: string, city?: string, region?: string, ip?: string } | null>(null)

  // Market-specific business hours: Owners or All Markets -> universal; Saudi/UAE/Dubai -> Sun–Thu
  const teamLowerForUser = String((currentUser as any)?.team || '').toLowerCase()
  const businessHours = useMemo(() => {
    if(roleLower === 'owner') return 'Mon–Fri 09:00–17:00'
    if(/all\s*market/.test(teamLowerForUser)) return 'Mon–Fri 09:00–17:00'
    if(/saudi/.test(teamLowerForUser)) return 'Sun–Thu 09:00–17:00'
    if(/dubai|uae/.test(teamLowerForUser)) return 'Sun–Thu 09:00–17:00'
    return 'Mon–Fri 09:00–17:00'
  }, [roleLower, teamLowerForUser])

  // API base: prefer VITE_API_URL, else if running on 4000 use same-origin, otherwise default to local server
  const apiBase = (import.meta as any)?.env?.VITE_API_URL || (window.location.port === '4000' ? '' : 'http://127.0.0.1:4000')
  const apiFetch = (path: string, init?: RequestInit) => {
    const authHeaders: Record<string,string> = {
      'X-User-Id': String((currentUser as any)?.id || ''),
      'X-User-Email': String((currentUser as any)?.email || '')
    }
    const merged: RequestInit = { ...init, headers: { ...(init?.headers as any), ...authHeaders } }
    return fetch(`${apiBase}${path}`, merged)
  }
  // usage session + timers
  const sessionIdRef = React.useRef<string>('')
  const mountTsRef = React.useRef<number>(0)
  const flushedRef = React.useRef<boolean>(false)
  function genSessionId(){
    const g: any = globalThis as any
    if(g?.crypto?.randomUUID){ return g.crypto.randomUUID() as string }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
  async function sendUsage(activity_type: string, activity_details?: any, time_spent_seconds?: number){
    try{
      if(!sessionIdRef.current) sessionIdRef.current = genSessionId()
      let API_BASE = (import.meta as any).env?.VITE_API_BASE || ''
      if(!API_BASE && typeof window !== 'undefined'){
        const host = (window.location && window.location.hostname) || 'localhost'
        if(host === 'localhost' || host === '127.0.0.1'){
          API_BASE = 'http://localhost:4000'
        }
      }
      const body: any = {
        user_id: String((currentUser as any)?.id || (currentUser as any)?.ID || 'unknown'),
        activity_type,
        activity_details: activity_details ? JSON.stringify(activity_details) : undefined,
        session_id: sessionIdRef.current,
        time_spent_seconds: typeof time_spent_seconds === 'number' ? time_spent_seconds : undefined,
      }
      const hdrs: Record<string,string> = { 'Content-Type': 'application/json' }
      const uid = String((currentUser as any)?.id || (currentUser as any)?.ID || '')
      const uemail = String((currentUser as any)?.email || '')
      if(uid) hdrs['X-User-Id'] = uid
      if(uemail) hdrs['X-User-Email'] = uemail
      await fetch((API_BASE || '') + '/api/usage', { method: 'POST', headers: hdrs, body: JSON.stringify(body) })
    }catch{ /* ignore */ }
  }
  React.useEffect(() => {
    if(!sessionIdRef.current) sessionIdRef.current = genSessionId()
    mountTsRef.current = Date.now()
    flushedRef.current = false
    sendUsage('settings_page_open', { path: (typeof location !== 'undefined' ? location.pathname : '') }).catch(()=>{})
    function flush(reason: string){
      if(flushedRef.current) return
      const start = mountTsRef.current || Date.now()
      const sec = Math.max(0, Math.round((Date.now() - start) / 1000))
      flushedRef.current = true
      sendUsage('settings_page_time', { reason, path: (typeof location !== 'undefined' ? location.pathname : '') }, sec)
    }
    const onPageHide = () => flush('pagehide')
    const onBeforeUnload = () => flush('beforeunload')
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => { window.removeEventListener('pagehide', onPageHide); window.removeEventListener('beforeunload', onBeforeUnload); flush('unmount') }
  }, [])

  // --- Users & Access prototype state (in-memory demo data) -----------------
  // Roles simplified to canonical set
  type RoleName = 'User' | 'Admin' | 'Owner'
  const simplifyRole = (r?: string): RoleName => {
    const s = (r || '').toString().trim().toLowerCase()
    if(s === 'owner' || s === 'superadmin' || s === 'super admin' || s === 'root' || s === 'founder' || s === 'ceo') return 'Owner'
    if(s === 'admin' || s === 'administrator') return 'Admin'
    return 'User'
  }
  type User = {
    id: string
    name: string
    email: string
    role: RoleName
    teams: string[]
    status: 'Active' | 'Suspended' | 'Removed' | 'Pending'
    lastLogin?: string
    mfa?: boolean
    phone?: string
    password?: string
    managerId?: string
  }

  const [users, setUsers] = useState<User[]>(() => [
    // Owners (super users)
    { id: 'u_1', name: 'Simo Kouidi', email: 'Simo.kouidi@electrixspace.com', role: simplifyRole('Owner'), teams: ['All Markets'], status: 'Active', lastLogin: '2025-09-10T09:00:00Z', mfa: true },
    { id: 'u_2', name: 'Andrea Di Palma', email: 'andrea.dipalma@electrixspace.com', role: simplifyRole('Owner'), teams: ['All Markets'], status: 'Active', lastLogin: '2025-09-09T11:12:00Z', mfa: true },
    { id: 'u_12', name: 'ELECTRIX', email: 'careforce@electrixspace.com', role: simplifyRole('Owner'), teams: ['All Markets'], status: 'Active', lastLogin: '2025-07-01T08:00:00Z', mfa: false },
    // Admins
    { id: 'u_3', name: 'Mohammad Jazzar', email: 'Mohammad.Jazzar@electrixspace.com', role: simplifyRole('Admin'), teams: ['Saudi Arabia'], status: 'Active', lastLogin: '2025-09-08T08:45:00Z', mfa: true },
    { id: 'u_11', name: 'Christopher Poon', email: 'Christopher.poon@electrixspace.com', role: simplifyRole('Admin'), teams: ['All Markets'], status: 'Active', lastLogin: '2025-08-10T09:00:00Z', mfa: true },
    // Users in Saudi Arabia (report to Mohammad; using market team for RLS)
    { id: 'u_4', name: 'Youssef Boussetta', email: 'Youssef.boussetta@electrixspace.com', role: simplifyRole('User'), teams: ['Saudi Arabia'], status: 'Active', lastLogin: '2025-09-01T10:20:00Z', mfa: false },
    { id: 'u_5', name: 'Mohammed Wasim', email: 'Mohammed.Wasim@electrixspace.com', role: simplifyRole('User'), teams: ['Saudi Arabia'], status: 'Active', lastLogin: '2025-08-28T12:00:00Z', mfa: false },
    { id: 'u_6', name: 'Mohammed Ali', email: 'Mohammed.Ali@electrixspace.com', role: simplifyRole('User'), teams: ['Saudi Arabia'], status: 'Active', lastLogin: '2025-08-25T09:30:00Z', mfa: false },
    { id: 'u_7', name: 'Eslam El Malah', email: 'Eslam.elmalah@electrixspace.com', role: simplifyRole('User'), teams: ['Saudi Arabia'], status: 'Active', lastLogin: '2025-08-20T14:50:00Z', mfa: false },
    { id: 'u_9', name: 'Abdulfattah Aljamal', email: 'Abdulfattah.aljamal@electrixspace.com', role: simplifyRole('User'), teams: ['Saudi Arabia'], status: 'Active', lastLogin: '2025-08-15T08:30:00Z', mfa: false },
    { id: 'u_10', name: 'Sami Alsawaftah', email: 'Sami.alsawaftah@electrixspace.com', role: simplifyRole('User'), teams: ['Saudi Arabia'], status: 'Active', lastLogin: '2025-08-12T16:00:00Z', mfa: false },
    // User in Dubai Sales
    { id: 'u_8', name: 'Arman Aras', email: 'Arman.Aras@electrixspace.com', role: simplifyRole('User'), teams: ['Dubai Sales'], status: 'Active', lastLogin: '2025-08-18T09:15:00Z', mfa: false },
  ])

  const [roles] = useState<string[]>(['User','Admin','Owner'])
  const [teamsState, setTeamsState] = useState<string[]>(['Dubai Sales', 'Saudi Arabia', 'All Markets'])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  // Filters & search for Users table
  const [roleFilter, setRoleFilter] = useState<'All' | RoleName>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Suspended' | 'Removed' | 'Pending'>('All')
  const [search, setSearch] = useState<string>('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteData, setInviteData] = useState({ name: '', email: '', personalEmail: '', role: 'User', team: teamsState[0] || '', phone: '', status: 'Active', password: '' as string, lastLogin: '' as string })
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editData, setEditData] = useState<{ name: string; email: string; personalEmail: string; role: string; team: string; phone: string; status: string; password: string; lastLogin: string }>(
    { name: '', email: '', personalEmail: '', role: 'User', team: '', phone: '', status: 'Active', password: '', lastLogin: '' }
  )
  // Users table: show 5 rows with scroll

  // simple activity log for demo
  const [activityLogs, setActivityLogs] = useState<Array<{ id: string; text: string; when: string }>>([])

  // Table viewport: show 5 rows; scroll for more users
  const ROW_HEIGHT = 64
  const VISIBLE_ROWS = 5

  const toggleSelect = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }))
  const selectAll = (on: boolean) => setSelected(Object.fromEntries(users.map(u => [u.id, on])))

  const exportUsersCSV = () => {
    const rows = [['Name', 'Email', 'Role', 'Teams', 'Status', 'Last Login', 'MFA']]
    users.forEach(u => rows.push([u.name, u.email, u.role, u.teams.join('|'), u.status, u.lastLogin || '', u.mfa ? 'Yes' : 'No']))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'users.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Delete confirmation modal state
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ id: string; email: string } | null>(null)
  // Modal for showing generated credentials after create/reset
  const [credModal, setCredModal] = useState<null | { email: string; password: string; title: string }>(null)
  // UI state: show/hide password in Edit modal
  const [showEditPassword, setShowEditPassword] = useState(false)
  // UI state: show/hide password in Invite modal
  const [showInvitePassword, setShowInvitePassword] = useState(false)
  // UI state: show/hide password in Credentials modal
  const [showCredPassword, setShowCredPassword] = useState(false)

  // Open Edit modal and load current password_plain from server
  const openEdit = async (u: User) => {
    // Admins have view-only access — do not open the edit modal or fetch secrets
    if(isAdmin){
      alert('Admins have view-only access. Please contact IT to make any changes.')
      return
    }
  setEditUser(u)
  setShowEditPassword(false)
  setEditData({ name: u.name, email: u.email, personalEmail: (u as any).personalEmail || (u as any).personal_email || '', role: String(u.role), team: u.teams[0] || '', phone: u.phone || '', status: u.status, password: '', lastLogin: u.lastLogin || '' })
    // Hydrate latest fields from DB (phone, personal email, team, status, etc.)
    try{
      const r = await apiFetch(`/api/users/${u.id}`)
      if(r.ok){
        const j = await r.json().catch(()=>null)
        const row = j && j.data ? j.data : j
        if(row && typeof row === 'object'){
          setEditData(d=>({
            ...d,
            name: row.name ?? d.name,
            email: row.email ?? d.email,
            personalEmail: row.personalEmail || row.personal_email || d.personalEmail,
            role: String(row.role ?? d.role),
            team: row.team ?? d.team,
            phone: row.phone ?? d.phone,
            status: row.status ?? d.status,
            lastLogin: row.lastLogin || row.last_login || d.lastLogin,
          }))
        }
      }
    }catch{/* ignore and keep current */}
    // Only Owners can retrieve password secrets
    if(isOwner){
      try{
        const r = await apiFetch(`/api/users/${u.id}/secret`)
        if(r.ok){
          const j = await r.json().catch(()=>null)
          const pwd = j && j.data ? (j.data.password_plain ?? '') : ''
          if(typeof pwd === 'string') setEditData(d=>({ ...d, password: pwd }))
        }
      }catch{ /* ignore */ }
    }
  }

  // Submit handler for Edit modal. Sends updates to server, verifies, refreshes list, and shows reset modal if needed.
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!editUser) return
    const resetting = !!editData.password
    const shownPassword = resetting ? editData.password : null
  const roleToSend = editData.role
    try{
      const res = await apiFetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          email: editData.email,
          personalEmail: editData.personalEmail || undefined,
          personal_email: editData.personalEmail || undefined,
          role: roleToSend,
          team: editData.team,
          phone: editData.phone,
          status: editData.status,
          password: editData.password || undefined,
          lastLogin: editData.lastLogin || undefined,
        })
      })
      if(!res.ok){
        const t = await res.text().catch(()=>`${res.status} ${res.statusText}`)
        alert(`Failed to save user: ${t}`)
        return
      }
      try{
        const j = await res.json()
        if(j?.meta && j.meta.passwordVerified === false){
          alert('Warning: Password verification failed on the server. Please try generating a new password and saving again.')
          return
        }
      }catch{ /* ignore parse */ }

      // Refresh list from server after save to reflect canonical data (including role)
      try{
        const jr = await apiFetch('/api/users')
        if(jr.ok){
          const jj = await jr.json().catch(()=>null)
          const data = Array.isArray(jj) ? jj : (jj && Array.isArray(jj.data) ? jj.data : [])
          if(Array.isArray(data)){
            setUsers(data.map((u:any)=>({
              id: String(u.id),
              name: u.name || (u.email ? String(u.email).split('@')[0] : 'User'),
              email: u.email,
              phone: u.phone ?? u.Phone,
              role: simplifyRole(u.role),
              teams: u.team ? [u.team] : [],
              managerId: u.managerId || u.manager_id || u.ManagerId,
              status: u.status || 'Active',
              lastLogin: u.lastLogin || u.last_login || undefined,
              mfa: !!u.mfa,
              personalEmail: u.personalEmail || u.personal_email
            })))
          }
        }
      }catch{ /* ignore */ }

      // Local optimistic update (fallback)
  setUsers(prev => prev.map(p => p.id===editUser.id ? { ...p, name: editData.name, email: editData.email, role: simplifyRole(editData.role), teams: editData.team ? [editData.team] : [], phone: editData.phone, status: editData.status as any, lastLogin: editData.lastLogin || p.lastLogin, personalEmail: editData.personalEmail } : p))

      // Log what changed for visibility
      try{
        const before = users.find(u=>u.id===editUser.id)
        const changed: string[] = []
        if(before){
          if(before.name !== editData.name) changed.push(`name: "${before.name}" → "${editData.name}"`)
          if(before.email !== editData.email) changed.push(`email: ${before.email} → ${editData.email}`)
          if(String(before.role) !== String(editData.role)) changed.push(`role: ${before.role} → ${editData.role}`)
          if((before.teams?.[0]||'') !== (editData.team||'')) changed.push(`team: ${before.teams?.[0]||'-'} → ${editData.team||'-'}`)
          if(((before as any).personalEmail||'') !== (editData.personalEmail||'')) changed.push(`personal email: ${(before as any).personalEmail||'-'} → ${editData.personalEmail||'-'}`)
          if(String(before.status) !== String(editData.status)) changed.push(`status: ${before.status} → ${editData.status}`)
          if((before.phone||'') !== (editData.phone||'')) changed.push(`phone: ${before.phone||'-'} → ${editData.phone||'-'}`)
        }
        const actor = (currentUser as any)?.name || 'System'
        setActivityLogs(l => [
          { id: `a_${Date.now()}`, text: `${actor} updated ${editData.email}${changed.length ? ` (${changed.join(', ')})` : ''}`, when: new Date().toLocaleString() },
          ...l
        ])
      }catch{/* ignore */}

      const emailNow = editData.email
      setEditUser(null)
      if(resetting && shownPassword){
        setCredModal({ email: emailNow, password: shownPassword, title: 'Password Reset' })
      }
    }catch(err){
      alert('Network error while saving user')
      return
    }
  }

  const handleDeleteConfirmed = async () => {
    if(!confirmDeleteUser) return
    if(isAdmin){
      alert('Admins cannot remove users. Please contact IT to make this change.')
      setConfirmDeleteUser(null)
      return
    }
    const { id: userId, email } = confirmDeleteUser
    try{
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' })
      if(!res.ok && res.status !== 404){
        const msg = await res.text().catch(()=>`${res.status} ${res.statusText}`)
        alert(`Failed to delete user: ${msg}`)
        return
      }
      setUsers(prev => prev.filter(u => u.id !== userId))
      setActivityLogs(l => [
        { id: `a_${Date.now()}`, text: `${(currentUser as any)?.name || 'System'} removed access for ${email}`, when: new Date().toLocaleString() },
        ...l
      ])
      if(res.status === 404){
        console.warn(`User ${userId} not found in DB; removed locally.`)
      }
    }catch(err:any){
      alert(`Failed to delete user due to a network error.`)
    } finally {
      setConfirmDeleteUser(null)
    }
  }

  const inviteSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    // Prefer any password currently in the form; otherwise generate one now
    const tempPassword = inviteData.password || generateSecurePassword(12)
  const roleToSend = inviteData.role
    // Try to persist on the backend first
    try{
      // Send chosen/generated password to server; backend will hash
  const body:any = { name: inviteData.name, email: inviteData.email, personalEmail: inviteData.personalEmail || undefined, personal_email: inviteData.personalEmail || undefined, role: roleToSend, phone: inviteData.phone, team: inviteData.team, status: inviteData.status, password: tempPassword, lastLogin: inviteData.lastLogin || undefined }
      const res = await apiFetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if(res.ok){
        let meta:any = null
        try{ const j = await res.json(); meta = j?.meta || null }catch{/* ignore parse */}
        if(meta && meta.passwordVerified === false){
          alert('Warning: Password verification failed on the server. Please try generating a new password and saving again.')
          return
        }
        // refresh list from server to reflect true data (id, defaults)
        try{
          const j = await apiFetch('/api/users').then(r=>r.ok?r.json():Promise.reject(r))
          const data = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : [])
          if(Array.isArray(data)){
            // Map to local demo shape
            setUsers(data.map((u:any)=>({
              id: String(u.id),
              name: u.name || (u.email ? u.email.split('@')[0] : 'User'),
              email: u.email,
              phone: u.phone,
              role: simplifyRole(u.role),
              teams: u.team ? [u.team] : [],
              managerId: u.managerId || u.manager_id || u.ManagerId,
              status: (u.status as any) || 'Active',
              lastLogin: u.lastLogin || u.last_login || undefined,
              mfa: !!u.mfa,
              personalEmail: u.personalEmail || u.personal_email
            })))
          }
        }catch{}
        setActivityLogs(l => [
          { id: `a_${Date.now()}`, text: `${(currentUser as any)?.name || 'System'} created access for ${inviteData.email} (${inviteData.role}, ${inviteData.team || 'No Team'})`, when: new Date().toLocaleString() },
          ...l
        ])
        // Show credentials modal for copy/share
  setCredModal({ email: inviteData.email, password: tempPassword, title: 'User Access Created' })
  setInviteData({ name: '', email: '', personalEmail: '', role: 'User', team: teamsState[0] || '', phone: '', status: 'Active', password: '', lastLogin: '' })
        setShowInvite(false)
        return
      }
      // If server responded with error, surface it and do not fallback
      try{
        const errText = await res.text()
        alert(`Failed to create user: ${errText}`)
      }catch{
        alert(`Failed to create user: ${res.status} ${res.statusText}`)
      }
      return
    }catch(err){ /* ignore and fallback */ }

    // Fallback: local-only insert in demo mode
    const id = `u_${Math.random().toString(36).slice(2,9)}`
  setUsers(u => [{ id, name: inviteData.name || inviteData.email.split('@')[0], email: inviteData.email, role: simplifyRole(inviteData.role), teams: inviteData.team ? [inviteData.team] : [], status: inviteData.status as any, mfa: false, phone: inviteData.phone, personalEmail: inviteData.personalEmail }, ...u])
    setActivityLogs(l => [
      { id: `a_${Date.now()}`, text: `${(currentUser as any)?.name || 'System'} created access for ${inviteData.email} (${inviteData.role}, ${inviteData.team || 'No Team'})`, when: new Date().toLocaleString() },
      ...l
    ])
  setCredModal({ email: inviteData.email, password: tempPassword, title: 'User Access Created' })
  setInviteData({ name: '', email: '', personalEmail: '', role: 'User', team: teamsState[0] || '', phone: '', status: 'Active', password: '', lastLogin: '' })
    setShowInvite(false)
  }


  useEffect(()=>{
    // Try to hydrate Users list from server on tab load
    (async () => {
      try{
  const r = await apiFetch('/api/users')
        if(!r.ok) return
        const j = await r.json().catch(()=>null)
        const data = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : [])
        if(Array.isArray(data) && data.length){
          setUsers(data.map((u:any)=>({
            id: String(u.id),
            name: u.name || (u.email ? String(u.email).split('@')[0] : 'User'),
            email: u.email,
            phone: u.phone ?? u.Phone,
            role: simplifyRole(u.role),
            teams: u.team ? [u.team] : [],
            managerId: u.managerId || u.manager_id || u.ManagerId,
            status: u.status || 'Active',
            lastLogin: u.lastLogin || u.last_login || undefined,
            mfa: !!u.mfa,
            personalEmail: u.personalEmail || u.personal_email
          })))
        }
      }catch{/* ignore and keep local demo */}
    })()
    let mounted = true
    fetch('https://ipapi.co/json/')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data) => {
        if(!mounted) return
        setDetected({ timezone: data.timezone, country: data.country_name, city: data.city, region: data.region, ip: data.ip })
      })
      .catch(()=>{
        // ignore failures; fallback to browser timezone
        if(!mounted) return
        setDetected({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      })
    return ()=>{ mounted = false }
  }, [])

  // Reset credential password visibility whenever the modal opens
  useEffect(()=>{
    if(credModal){ setShowCredPassword(false) }
  }, [credModal])

  // Helper: download a JSON snapshot of the org settings
  const downloadConfig = () => {
    const snapshot = {
      organization: {
        name: 'ELECTRIX',
        legalEntity: 'Electrix Data',
        primaryDomain: 'www.electrixdata.com',
        address: 'Commercial Building, 317-319 Des Voeux Road, Central, Hong Kong',
        industry: 'Software',
      },
      regionalDefaults: {
        timezone: detected?.timezone ?? 'UTC',
        locale: navigator.language ?? 'en-GB',
        businessHours: 'Mon–Fri 09:00–17:00',
      },
      governance: {
        dataResidency: 'Hong Kong / Dubai',
        dataRetention: 'Inactive records are kept for 18 months',
        auditLogRetention: '1 year',
        privacyContact: 'Careforce@electrixspace.com',
        securityDefaults: { mfaRequired: true, ssoEnforced: false },
      },
      website: 'https://www.electrixdata.com',
  version: 'v0.1',
    }

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'electrix-org-config.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Trust server-side RLS for API responses, and also apply client-side clamping to mirror the
  // same visibility rules used in Dashboard/Clients/Activities (defense-in-depth):
  // - Owner: see everyone
  // - Admin (All Markets): see Admins + Users (not Owners)
  // - Admin (specific market): see Users/BDMs in their market OR who report to them, plus themselves
  // - User: see only their own account
  const currentRole = roleLower
  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'admin'
  const isPrivileged = isOwner || isAdmin
  const effectiveUsers = useMemo(() => {
    const all = Array.isArray(users) ? users : []
    if(isOwner) return all
    const meId = String((currentUser as any)?.id || '')
    const meEmail = String((currentUser as any)?.email || '').toLowerCase()
    if(isAdmin){
      const adminTeamLower = String((currentUser as any)?.team || '').toLowerCase()
      if(adminTeamLower.includes('all market')){
        // All Markets admin: hide owners, show admins+users
        return all.filter(u => String(u.role || '').toLowerCase() !== 'owner')
      }
      // Market admin: users/BDMs in same market OR who report to this admin; always include self
      return all.filter(u => {
        const r = String(u.role || '').toLowerCase()
        const teams = Array.isArray(u.teams) ? u.teams : []
        const sameTeam = teams.some(t => String(t || '').toLowerCase() === adminTeamLower)
        const isUserLevel = r === 'user' || r === 'bdm'
        const reportsToAdmin = String((u as any).managerId || '').toLowerCase() === meId.toLowerCase()
        const isSelf = String(u.id) === meId || String((u.email || '')).toLowerCase() === meEmail
        return isSelf || (isUserLevel && (sameTeam || reportsToAdmin))
      })
    }
    // Default: user-level sees only themselves
    return all.filter(u => String(u.id) === meId || String((u.email || '')).toLowerCase() === meEmail)
  }, [users, isOwner, isAdmin, (currentUser as any)?.team, (currentUser as any)?.id, (currentUser as any)?.email])

  // Helpers for UI styling
  function rolePillClass(role: string){
    const r = String(role || '').toLowerCase()
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border'
    if(r === 'owner') return `${base} bg-slate-900 text-white border-slate-900`
    if(r === 'admin') return `${base} bg-blue-50 text-blue-700 border-blue-200`
    return `${base} bg-gray-100 text-gray-700 border-gray-200`
  }
  function statusDotClass(status: string){
    const s = String(status || '').toLowerCase()
    if(s === 'active') return 'bg-emerald-500'
    if(s === 'suspended') return 'bg-amber-500'
    if(s === 'removed') return 'bg-rose-500'
    return 'bg-slate-400'
  }
  function teamTagClass(team: string){
    const t = String(team || '')
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs border'
    if(/saudi/i.test(t)) return `${base} bg-blue-50 text-blue-700 border-blue-200`
    if(/all market/i.test(t)) return `${base} bg-gray-100 text-gray-700 border-gray-200`
    if(/dubai/i.test(t)) return `${base} bg-violet-50 text-violet-700 border-violet-200`
    return `${base} bg-slate-50 text-slate-700 border-slate-200`
  }

  // Apply filters and search
  const displayedUsers = useMemo(() => {
    let list = effectiveUsers
    if(roleFilter !== 'All'){
      const rl = String(roleFilter).toLowerCase()
      list = list.filter(u => String(u.role || '').toLowerCase() === rl)
    }
    if(statusFilter !== 'All'){
      const st = String(statusFilter).toLowerCase()
      list = list.filter(u => String(u.status || '').toLowerCase() === st)
    }
    if(search.trim()){
      const q = search.trim().toLowerCase()
      list = list.filter(u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q))
      )
    }
    return list
  }, [effectiveUsers, roleFilter, statusFilter, search])

  return (
    <div className="min-h-screen overflow-x-hidden antialiased">
      <div className="max-w-7xl mx-auto px-6">
  {/* header removed as requested */}

  <main className="mt-6 pb-12">
        {tab === 'Organization' && (
          <div className="card p-6">
            {/* Top summary hero */}
            <div className="rounded-2xl p-3.5 md:p-4 bg-white border border-gray-200 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-3.5 lg:items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md">
                    <img src={Logo} alt="ELECTRIX logo" className="w-7 h-7 object-contain" />
                  </div>
                  <div>
                    <div className="text-lg font-bold tracking-tight text-slate-900">ELECTRIX</div>
                    <div className="text-[12px] text-slate-500">Signal‑to‑Action AI & Data Analytics</div>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-slate-700 text-sm">
                    <Globe size={16} className="text-slate-500" />
                    <a href="https://www.electrixdata.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700">www.electrixdata.com</a>
                  </div>
                  {/* Status badge removed per request */}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={()=>window.open('mailto:Careforce@electrixspace.com')}>Request change</Button>
                  <Button onClick={downloadConfig}>Download config</Button>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Clock size={14} className="text-slate-400" />
                <span className="text-slate-600">Last updated: Today</span>
              </div>
            </div>

            {/* Grouped content cards */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Organization Profile */}
              <div className="p-3 rounded-2xl border border-gray-200 bg-white">
                <div className="text-[11px] tracking-wider text-slate-500">ORGANIZATION</div>
                <h3 className="mt-0.5 text-[15px] font-semibold text-slate-900">Organization Profile</h3>
                <dl className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13.5px]">
                  <div className="flex items-start gap-2">
                    <Building2 size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Legal entity</div>
                      <div className="font-medium text-slate-900">Electrix Data</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Globe size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Industry</div>
                      <div className="font-medium text-slate-900">Software</div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-start gap-2">
                    <MapPin size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Registered address</div>
                      <div className="font-medium text-slate-900">Commercial Building, 317-319 Des Voeux Road, Central, Hong Kong</div>
                    </div>
                  </div>
                </dl>
              </div>

              {/* Operational Settings (merged system info) */}
              <div className="p-3 rounded-2xl border border-gray-200 bg-white">
                <div className="text-[11px] tracking-wider text-slate-500">OPERATIONS</div>
                <h3 className="mt-0.5 text-[15px] font-semibold text-slate-900">Operational Settings</h3>
                <dl className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13.5px]">
                  <div className="flex items-start gap-2">
                    <Clock size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Timezone</div>
                      <div className="font-medium text-slate-900">{detected?.timezone ?? 'Detecting...'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Local time</div>
                      <div className="font-medium text-slate-900">
                        {(() => {
                          const tz = detected?.timezone
                          const locale = navigator.language || 'en-GB'
                          try {
                            if (tz) {
                              const formatted = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date())
                              return formatted
                            }
                          } catch (e) { /* fallback */ }
                          return new Date().toLocaleString()
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <SettingsIcon size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Business hours</div>
                      <div className="font-medium text-slate-900">{businessHours}</div>
                    </div>
                  </div>
                  {/* System version removed per request */}
                </dl>
              </div>

              {/* Governance & Security (full width) */}
              <div className="md:col-span-2 p-3 rounded-2xl border border-gray-200 bg-white">
                <div className="text-[11px] tracking-wider text-slate-500">SECURITY</div>
                <h3 className="mt-0.5 text-[15px] font-semibold text-slate-900">Governance & Security</h3>
                <dl className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13.5px]">
                  <div className="flex items-start gap-2">
                    <Shield size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Data residency</div>
                      <div className="font-medium text-slate-900">Hong Kong / Dubai</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Data retention</div>
                      <div className="font-medium text-slate-900">Inactive records are kept for 18 months</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Audit log retention</div>
                      <div className="font-medium text-slate-900">1 year</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Privacy contact</div>
                      <div className="font-medium text-slate-900">Careforce@electrixspace.com</div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-start gap-2">
                    <Shield size={16} className="mt-0.5 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Security defaults</div>
                      <div className="font-medium text-slate-900">MFA required: Yes · SSO enforced: No</div>
                    </div>
                  </div>
                </dl>
              </div>
            </div>

            {/* Quick actions */}
              <div className="mt-3">
              <div className="text-[11px] tracking-wider text-slate-500">QUICK ACTIONS</div>
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  className="group text-left p-2.5 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
                  onClick={()=> setSelectedSettingsTab('Users & Access' as any)}
                >
                  <div className="flex items-center gap-2 text-slate-900">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                      <UsersIcon size={16} />
                    </div>
                    <div className="font-medium text-slate-900">Manage users</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Shortcut to access settings</div>
                </button>

                <button
                  className="group text-left p-2.5 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
                  onClick={()=> setSelectedSettingsTab('Audit & Security' as any)}
                >
                  <div className="flex items-center gap-2 text-slate-900">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                      <Shield size={16} />
                    </div>
                    <div className="font-medium text-slate-900">Security center</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">MFA, SSO and audit</div>
                </button>

                <button
                  className="group text-left p-2.5 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
                  onClick={()=> window.open('mailto:Careforce@electrixspace.com')}
                >
                  <div className="flex items-center gap-2 text-slate-900">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                      <Edit3 size={16} />
                    </div>
                    <div className="font-medium text-slate-900">Edit profile</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Request organization info changes</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {tab !== 'Organization' && (
          <div>
            {tab === 'Users & Access' ? (
              <>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                {/* Page header with CTA */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Users & Access</h2>
                    <div className="text-sm text-slate-500">Manage users, roles, teams, and security settings.</div>
                    {!isPrivileged && (
                      <div className="mt-1 inline-flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        RLS active: you can only see and edit your own account
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] shadow-[0_6px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.45),0_0_12px_rgba(139,92,246,0.35)] hover:-translate-y-0.5"
                      onClick={()=>{ setInviteData(d=>({ ...d, password: generateSecurePassword(12) })); setShowInvitePassword(false); setShowInvite(true) }}
                    >
                      + Add User Access
                    </button>
                  )}
                </div>
                <div className="mt-3 border-t border-gray-200" />

                {/* Totals breakdown */}
                <div className="mt-3 text-xs text-slate-600">
                  {(() => {
                    const all = effectiveUsers
                    const cOwner = all.filter(u=>String(u.role).toLowerCase()==='owner').length
                    const cAdmin = all.filter(u=>String(u.role).toLowerCase()==='admin').length
                    const cUser = all.filter(u=>String(u.role).toLowerCase()==='user').length
                    return `${all.length} users · ${cOwner} Owners · ${cAdmin} Admins · ${cUser} Users`
                  })()}
                </div>

                {/* Filter bar */}
                <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value as any)} className="px-3 py-2 rounded-md border border-gray-200 text-sm bg-white">
                      {['All','Owner','Admin','User'].map(r => <option key={r}>{r}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} className="px-3 py-2 rounded-md border border-gray-200 text-sm bg-white">
                      {['All','Active','Suspended','Removed'].map(s => <option key={s}>{s}</option>)}
                    </select>
                    <div className="relative md:ml-auto">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email" className="pl-9 pr-3 py-2 rounded-md border border-gray-200 text-sm bg-white min-w-[220px]" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {/* Fixed-height viewport with scroll to show 5 rows */}
                    <div style={{ maxHeight: `${VISIBLE_ROWS * ROW_HEIGHT}px` }} className="overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-left">Name & Email</th>
                            <th className="px-4 py-3 text-left">Phone</th>
                            <th className="px-4 py-3 text-left">Role</th>
                            <th className="px-4 py-3 text-left">Team</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-left">Last Login</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {displayedUsers.map(u => (
                            <tr key={u.id} className="bg-white hover:bg-gray-50">
                              <td className="px-4 py-3 align-middle">
                                <div className="font-medium text-slate-900">{u.name}</div>
                                <div className="text-xs text-slate-500">{u.email}</div>
                              </td>
                              <td className="px-4 py-3 align-middle text-slate-600">{u.phone || '—'}</td>
                              <td className="px-4 py-3 align-middle">
                                <span className={rolePillClass(u.role)}>{u.role}</span>
                              </td>
                              <td className="px-4 py-3 align-middle text-slate-600">
                                {u.teams.length ? (
                                  <span className={teamTagClass(u.teams[0])}>{u.teams[0]}</span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <span className="inline-flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${statusDotClass(u.status)}`}></span><span className="text-slate-700 text-sm">{u.status}</span></span>
                              </td>
                              <td className="px-4 py-3 align-middle text-slate-600">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
                              <td className="px-4 py-3 align-middle">
                                <div className="flex items-center justify-end gap-2">
                                  <button title="Edit" aria-label={`Edit ${u.email}`} onClick={()=>openEdit(u)} className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 text-slate-700 hover:bg-gray-50"><Pencil size={16}/></button>
                                  {isOwner && (
                                    <button title="Delete" aria-label={`Delete ${u.email}`} onClick={()=>setConfirmDeleteUser({ id: u.id, email: u.email })} className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={16}/></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* bulk action controls removed per request */}
                </div>

                {/* Right columns below main list */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="mt-0 p-5 bg-white border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Lock size={18} className="text-slate-500" />
                        <h3 className="font-semibold text-slate-800">User Account Security</h3>
                      </div>
                      <div className="mt-3 space-y-2.5 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Enforce MFA</span>
                          <span className="text-xs text-slate-500">Require MFA for all users</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Reset password on first login</span>
                          <span className="text-xs text-slate-500">Temporary passwords must be changed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Enable SSO</span>
                          <span className="text-xs text-slate-500">SAML / OIDC</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="p-5 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Clock size={18} className="text-slate-500" />
                      <h3 className="font-semibold text-slate-800">Activity Logs</h3>
                    </div>
                    <div className="mt-3 space-y-2.5 text-sm text-slate-700">
                      {activityLogs.slice(0,5).map(a => (
                        <div key={a.id} className="flex items-start gap-2">
                          <span className="mt-1 w-2 h-2 rounded-full bg-slate-400 inline-block" />
                          <div>
                            <div className="text-sm font-medium text-slate-800">{a.text}</div>
                            <div className="text-xs text-slate-400">{a.when}</div>
                          </div>
                        </div>
                      ))}
                      <div className="mt-2">
                        <button className="text-sm text-indigo-600" onClick={()=>alert('Export logs (demo)')}>Export activity logs</button>
                      </div>
                    </div>
                  </aside>
                </div>

                {/* Invite modal (admins/owners only) */}
                {isOwner && showInvite && (
                  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                    <form onSubmit={inviteSubmit} className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xl">
                      <h3 className="text-2xl font-semibold text-slate-900">Add User Access</h3>
                      <div className="text-sm text-slate-500 mt-1">Set the user's details. Password is optional here; if provided, it's hashed on save. Status defaults to Active.</div>
                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-slate-600">Name</label>
                            <input placeholder="Full name" value={inviteData.name} onChange={(e)=>setInviteData(d=>({...d, name: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600">Email</label>
                            <input required value={inviteData.email} onChange={(e)=>setInviteData(d=>({...d, email: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-slate-600">Personal Email</label>
                            <input placeholder="user@gmail.com (optional)" value={inviteData.personalEmail} onChange={(e)=>setInviteData(d=>({...d, personalEmail: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600">Phone</label>
                            <input placeholder="+971 50 000 0000" value={inviteData.phone} onChange={(e)=>setInviteData(d=>({...d, phone: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-slate-600">Role</label>
                            <select value={inviteData.role} onChange={(e)=>setInviteData(d=>({...d, role: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200">
                              {roles.map(r => <option key={r}>{r}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600">Team</label>
                            <select value={inviteData.team} onChange={(e)=>setInviteData(d=>({...d, team: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200">
                              <option value="">(none)</option>
                              {teamsState.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                          <div>
                            <label className="block text-sm text-slate-600">Status</label>
                            <select value={inviteData.status} onChange={(e)=>setInviteData(d=>({...d, status: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200">
                              {['Active','Suspended','Removed'].map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600">Password</label>
                            <div className="mt-1 relative">
                              <input
                                type={showInvitePassword ? 'text' : 'password'}
                                value={inviteData.password}
                                onChange={(e)=>setInviteData(d=>({...d, password: e.target.value}))}
                                className="w-full rounded px-3 py-2 border border-gray-200 pr-20"
                              />
                              <button
                                type="button"
                                title={showInvitePassword ? 'Hide password' : 'Show password'}
                                aria-label={showInvitePassword ? 'Hide password' : 'Show password'}
                                onClick={()=>setShowInvitePassword(s=>!s)}
                                className="absolute right-10 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded border text-slate-600 hover:bg-gray-50"
                                style={{lineHeight:0}}
                              >
                                {showInvitePassword ? <EyeOff size={18} className="opacity-80"/> : <Eye size={18} className="opacity-80"/>}
                              </button>
                              <button
                                type="button"
                                title="Generate new password"
                                aria-label="Generate new password"
                                onClick={()=>setInviteData(d=>({...d, password: generateSecurePassword(12)}))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded hover:bg-gray-50"
                              >
                                <Key size={18} className="opacity-80"/>
                              </button>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">Use the key to generate; use the eye to show/hide.</div>
                          </div>
                        </div>
                        {/* Removed Last login from form per request */}
                      </div>
                      <div className="mt-5 flex items-center gap-3 justify-end">
                        <button type="button" className="text-sm text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100" onClick={()=>setShowInvite(false)}>Cancel</button>
                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] shadow-[0_6px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.45),0_0_12px_rgba(139,92,246,0.35)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#8B5CF6]/40" disabled={isAdmin} title={isAdmin ? 'Admins cannot add users' : undefined}>Create Access</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Edit modal */}
                {editUser && (
                  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                    <form onSubmit={handleEditSubmit} className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xl">
                      <h3 className="text-2xl font-semibold text-slate-900">Edit User Access</h3>
                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-slate-600">Name</label>
                            <input value={editData.name} onChange={(e)=>setEditData(d=>({...d, name: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" disabled={isAdmin} />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600">Email</label>
                            <input value={editData.email} onChange={(e)=>setEditData(d=>({...d, email: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" disabled={isAdmin} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-slate-600">Personal Email</label>
                            <input value={editData.personalEmail} onChange={(e)=>setEditData(d=>({...d, personalEmail: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" disabled={isAdmin} />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600">Phone</label>
                            <input value={editData.phone} onChange={(e)=>setEditData(d=>({...d, phone: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" disabled={isAdmin} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-slate-600">Role</label>
                            <select value={editData.role} onChange={(e)=>setEditData(d=>({...d, role: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" disabled={isAdmin}>
                              {roles.map(r => <option key={r}>{r}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-slate-600">Team</label>
                            <select value={editData.team} onChange={(e)=>setEditData(d=>({...d, team: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" disabled={isAdmin}>
                              <option value="">(none)</option>
                              {teamsState.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                          <div>
                            <label className="block text-sm text-slate-600">Status</label>
                            <select value={editData.status} onChange={(e)=>setEditData(d=>({...d, status: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" disabled={isAdmin}>
                              {['Active','Suspended','Removed'].map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          {!isAdmin && (
                            <div>
                              <label className="block text-sm text-slate-600">Password (reset)</label>
                              <div className="mt-1 relative">
                                <input
                                  type={showEditPassword ? 'text' : 'password'}
                                  placeholder="Leave blank to keep"
                                  value={editData.password}
                                  onChange={(e)=>setEditData(d=>({...d, password: e.target.value}))}
                                  className="w-full rounded px-3 py-2 border border-gray-200 pr-20"
                                />
                                <button
                                  type="button"
                                  title={showEditPassword ? 'Hide password' : 'Show password'}
                                  aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                                  onClick={()=>setShowEditPassword(s=>!s)}
                                  className="absolute right-10 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded border text-slate-600 hover:bg-gray-50"
                                  style={{lineHeight:0}}
                                >
                                  {showEditPassword ? <EyeOff size={18} className="opacity-80"/> : <Eye size={18} className="opacity-80"/>}
                                </button>
                                <button
                                  type="button"
                                  title="Generate new password"
                                  aria-label="Generate new password"
                                  onClick={()=>setEditData(d=>({...d, password: generateSecurePassword(12)}))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded hover:bg-gray-50"
                                >
                                  <Key size={18} className="opacity-80"/>
                                </button>
                              </div>
                              <div className="text-xs text-slate-400 mt-1">Use the key to generate; use the eye to show/hide.</div>
                            </div>
                          )}
                        </div>
                        {/* Removed Last login field per request */}
                      </div>
                      <div className="mt-5 flex items-center gap-3 justify-end">
                        <button type="button" className="text-sm text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100" onClick={()=>setEditUser(null)}>Cancel</button>
                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] shadow-[0_6px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.45),0_0_12px_rgba(139,92,246,0.35)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#8B5CF6]/40" disabled={isAdmin} title={isAdmin ? 'Admins have view-only access. Contact IT for changes.' : undefined}>Save</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Confirm delete modal (admins/owners only) */}
                {isOwner && confirmDeleteUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white p-5 rounded-xl shadow-xl w-full max-w-sm">
                      <h3 className="text-lg font-semibold text-slate-800">Remove access?</h3>
                      <p className="mt-2 text-sm text-slate-600">Are you sure you want to remove access for <span className="font-medium">{confirmDeleteUser.email}</span>?</p>
                      <div className="mt-5 flex items-center justify-end gap-2">
                        <button className="px-3 py-2 text-sm text-slate-600" onClick={()=>setConfirmDeleteUser(null)}>No</button>
                        <button className="px-4 py-2 text-sm rounded-md bg-red-600 text-white" onClick={handleDeleteConfirmed}>Yes, remove</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Credentials copy modal (after create/reset) */}
                {credModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl">
                      <h3 className="text-2xl font-semibold text-slate-900">{credModal.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">Share the following access details with the user. For security, they should change their password after first login.</p>
                      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-800">{credModal.email}</span></div>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="truncate"><span className="text-slate-500">Temporary password:</span> {" "}
                            <span className="font-medium text-slate-800">
                              {showCredPassword ? credModal.password : '•'.repeat(Math.max(8, credModal.password.length))}
                            </span>
                          </div>
                          <button
                            type="button"
                            title={showCredPassword ? 'Hide password' : 'Show password'}
                            aria-label={showCredPassword ? 'Hide password' : 'Show password'}
                            onClick={()=>setShowCredPassword(s=>!s)}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border text-slate-600 hover:bg-gray-100 flex-shrink-0"
                            style={{lineHeight:0}}
                          >
                            {showCredPassword ? <EyeOff size={18} className="opacity-80"/> : <Eye size={18} className="opacity-80"/>}
                          </button>
                        </div>
                        <div className="mt-3 text-slate-600">Message:</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words bg-white border border-gray-200 rounded-lg p-2.5">{`Hello,

Your ELECTRIX CRM access has been set up.

Email: ${credModal.email}
Temporary password: ${credModal.password}

Please sign in and change your password here:
${window.location.origin}/change-password?email=${credModal.email}

Thank you,
ELECTRIX Admin`}</pre>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <button className="px-3 py-2 rounded-lg border text-slate-700 hover:bg-slate-50" onClick={()=>{ const text = `Email: ${credModal.email}\nTemporary password: ${credModal.password}\nChange password: ${window.location.origin}/change-password?email=${credModal.email}`; navigator.clipboard?.writeText(text).catch(()=>{}); }}>Copy details</button>
                        <a className="text-indigo-600 hover:text-indigo-700" href={`/change-password?email=${encodeURIComponent(credModal.email)}`} target="_blank" rel="noreferrer">Open change password</a>
                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] shadow-[0_6px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.45),0_0_12px_rgba(139,92,246,0.35)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#8B5CF6]/40" onClick={()=>setCredModal(null)}>Done</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-800">{tab}</h2>
                </div>
                {tab === 'Automation' ? (
                  <AutomationTab isOwner={isOwner} isAdmin={isAdmin} />
                ) : (
                  <div className="text-sm text-slate-500">This section is scaffolded and will be implemented per your detailed spec.</div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  )
}

function AutomationTab({ isOwner, isAdmin }: { isOwner: boolean; isAdmin: boolean }){
  const [qr, setQr] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState<boolean>(false)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const viteEnv: any = (import.meta as any)?.env || {}
  const apiBase = viteEnv.VITE_API_URL || (window.location.port === '4000' ? '' : 'http://127.0.0.1:4000')

  const canView = isOwner
  React.useEffect(()=>{
    if(!canView) setError('You do not have access to Automation settings.')
  }, [canView])

  const fetchQr = async () => {
    setLoading(true)
    setError(null)
    try{
      const r = await fetch(`${apiBase}/api/bot/qr`)
      if(!r.ok){
        const txt = await r.text().catch(()=>`${r.status}`)
        throw new Error(txt)
      }
      const j = await r.json()
      setReady(!!j.ready)
      setQr(j.qr || null)
    }catch(e:any){
      setError('Failed to reach bot. Make sure the backend is running on port 4000.')
    } finally { setLoading(false) }
  }

  const refresh = () => fetchQr()

  return (
    <div>
      <div className="text-sm text-slate-700">Manage WhatsApp connection. Only Owners can access this page.</div>
      {!canView && (
        <div className="mt-3 text-rose-600 text-sm">Only Owners can view this page.</div>
      )}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white border border-gray-200 text-slate-800">
          <h3 className="font-semibold text-slate-800">Bot connection</h3>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={fetchQr} disabled={loading}>{loading ? 'Starting…' : 'Generate QR code'}</button>
              <button className="px-3 py-2 rounded-md border border-gray-300 text-slate-700 bg-white hover:bg-gray-50" onClick={fetchQr} disabled={loading}>Refresh</button>
            </div>
            <div className="text-xs text-slate-500">This will start the local WhatsApp bot (if not already running) and fetch a fresh QR. Scan it once; the session persists.</div>
            {error && <div className="text-sm text-rose-600">{error}</div>}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-gray-200 text-slate-800">
          <h3 className="font-semibold text-slate-800">Scan to connect</h3>
          <div className="mt-3 text-sm text-slate-700">If the bot is not connected yet, a QR will appear here. Open WhatsApp → Linked Devices → Link a device and scan it.</div>
          <div className="mt-4">
            {loading ? (
              <div className="text-slate-600">Loading…</div>
            ) : ready ? (
              <div className="text-green-700 bg-green-50 border border-green-200 rounded p-3 text-sm">Bot is connected and ready. No QR required.</div>
            ) : qr ? (
              <div>
                <img alt="WhatsApp QR" className="border border-gray-200 rounded" src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`} />
                <div className="mt-2 text-xs text-slate-500">If the QR expires, click Refresh.</div>
              </div>
            ) : (
              <div className="text-slate-600">No QR yet. Click "Generate QR code" to fetch.</div>
            )}
            <div className="mt-3"/>
          </div>
        </div>
      </div>
    </div>
  )
}
