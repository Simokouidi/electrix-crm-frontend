import React, { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import Button from '../components/Button'
import Logo from '../Images/Logo_copy2.png'

const TABS = [
  'Organization', 'Users & Access', 'Pipelines', 'Routing & SLAs', 'Sequences', 'Messaging & Calendars', 'Notifications', 'Data', 'Automation', 'Audit & Security', 'Billing', 'Environments'
]

export default function SettingsPage(){
  const { team, reset, selectedSettingsTab, setSelectedSettingsTab } = useStore()
  const tab = selectedSettingsTab

  const [detected, setDetected] = useState<{ timezone?: string, country?: string, city?: string, region?: string, ip?: string } | null>(null)

  // --- Users & Access prototype state (in-memory demo data) -----------------
  type RoleName = 'Admin' | 'Manager' | 'Sales Rep' | 'Read-only'
  type User = {
    id: string
    name: string
    email: string
    role: RoleName | string
    teams: string[]
    status: 'Active' | 'Pending' | 'Suspended'
    lastLogin?: string
    mfa?: boolean
  }

  const [users, setUsers] = useState<User[]>(() => [
    { id: 'u_1', name: 'Simo Kouidi', email: 'Simo.kouidi@electrixspace.com', role: 'Admin', teams: ['Executive'], status: 'Active', lastLogin: '2025-09-10T09:00:00Z', mfa: true },
    { id: 'u_2', name: 'Andrea Di Palma', email: 'andrea.dipalma@electrixspace.com', role: 'Admin', teams: ['Delivery'], status: 'Active', lastLogin: '2025-09-09T11:12:00Z', mfa: true },
    { id: 'u_3', name: 'Mohammad Jazzar', email: 'Mohammad.Jazzar@electrixspace.com', role: 'Admin', teams: ['BD'], status: 'Active', lastLogin: '2025-09-08T08:45:00Z', mfa: true },
    { id: 'u_4', name: 'Youssef Boussetta', email: 'Youssef.boussetta@electrixspace.com', role: 'BDM', teams: ['BD'], status: 'Active', lastLogin: '2025-09-01T10:20:00Z', mfa: false },
    { id: 'u_5', name: 'Mohammed Wasim', email: 'Mohammed.Wasim@electrixspace.com', role: 'BDM', teams: ['BD'], status: 'Active', lastLogin: '2025-08-28T12:00:00Z', mfa: false },
    { id: 'u_6', name: 'Mohammed Ali', email: 'Mohammed.Ali@electrixspace.com', role: 'BDM', teams: ['BD'], status: 'Active', lastLogin: '2025-08-25T09:30:00Z', mfa: false },
    { id: 'u_7', name: 'Eslam El Malah', email: 'Eslam.elmalah@electrixspace.com', role: 'BDM', teams: ['BD'], status: 'Active', lastLogin: '2025-08-20T14:50:00Z', mfa: false },
    { id: 'u_8', name: 'Arman Aras', email: 'Arman.Aras@electrixspace.com', role: 'BDM', teams: ['BD'], status: 'Active', lastLogin: '2025-08-18T09:15:00Z', mfa: false },
    { id: 'u_9', name: 'Abdulfattah Aljamal', email: 'Abdulfattah.aljamal@electrixspace.com', role: 'BDM', teams: ['BD'], status: 'Active', lastLogin: '2025-08-15T08:30:00Z', mfa: false },
    { id: 'u_10', name: 'Sami Alsawaftah', email: 'Sami.alsawaftah@electrixspace.com', role: 'BDM', teams: ['BD'], status: 'Active', lastLogin: '2025-08-12T16:00:00Z', mfa: false },
    { id: 'u_11', name: 'Christopher Poon', email: 'Christopher.poon@electrixspace.com', role: 'Manager', teams: ['BD'], status: 'Active', lastLogin: '2025-08-10T09:00:00Z', mfa: true },
    { id: 'u_12', name: 'ELECTRIX', email: 'careforce@electrixspace.com', role: 'Service', teams: [], status: 'Active', lastLogin: '2025-07-01T08:00:00Z', mfa: false },
  ])

  const [roles] = useState<string[]>(['Admin', 'Manager', 'Sales Rep', 'Read-only'])
  const [teamsState, setTeamsState] = useState<string[]>(['Dubai Sales', 'Saudi Arabia', 'All Markets'])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [showInvite, setShowInvite] = useState(false)
  const [inviteData, setInviteData] = useState({ email: '', role: 'Sales Rep', team: teamsState[0] || '' })

  // simple activity log for demo
  const [activityLogs, setActivityLogs] = useState<Array<{ id: string; text: string; when: string }>>([
    { id: 'a1', text: 'Christopher Jones logged in', when: '2025-08-28 14:02' },
    { id: 'a2', text: 'Ahmed Hassan changed role for Fatima Khan', when: '2025-08-27 11:10' },
  ])

  // Table viewport: always show 4 rows; small scroll when more users exist
  const ROW_HEIGHT = 64
  const VISIBLE_ROWS = 4

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

  const inviteSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const id = `u_${Math.random().toString(36).slice(2,9)}`
    setUsers(u => [{ id, name: inviteData.email.split('@')[0], email: inviteData.email, role: inviteData.role, teams: inviteData.team ? [inviteData.team] : [], status: 'Pending', mfa: false }, ...u])
    setActivityLogs(l => [{ id: `a_${Date.now()}`, text: `Invite sent to ${inviteData.email}`, when: new Date().toLocaleString() }, ...l])
    setInviteData({ email: '', role: 'Sales Rep', team: teamsState[0] || '' })
    setShowInvite(false)
  }


  useEffect(()=>{
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
      version: 'v0.1 prototype',
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

  return (
    <div className="min-h-screen overflow-x-hidden antialiased">
      <div className="max-w-6xl mx-auto px-6">
  {/* header removed as requested */}

  <main className="mt-6 pb-12">
        {tab === 'Organization' && (
          <div className="card p-6">
            {/* Hero: single logo, name, tagline, actions */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md">
                  <img src={Logo} alt="ELECTRIX logo" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight">ELECTRIX</div>
                  <div className="text-sm text-slate-400">Signal‑to‑Action AI & Data Analytics</div>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button onClick={()=>window.open('mailto:Careforce@electrixspace.com')} className="bg-indigo-600">Request change</Button>
                <Button onClick={downloadConfig} className="bg-white/6">Download config</Button>
                <Button onClick={()=>alert('Open audit log (prototype)')} className="bg-white/6">View audit log</Button>
              </div>
            </div>

            {/* Main layout: keep style but update fields per request */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 bg-transparent border border-white/6 rounded-2xl shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Core Identity (simplified per request) */}
                  <div className="p-4 bg-transparent border border-white/6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Core identity</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-400">
                      <div>
                        <div className="text-slate-400">Organization name</div>
                        <div className="mt-1 font-medium text-slate-100">ELECTRIX</div>
                      </div>

                      <div>
                        <div className="text-slate-400">Primary domain</div>
                        <div className="mt-1 font-medium">www.electrixdata.com</div>
                      </div>

                      <div>
                        <div className="text-slate-400">Legal entity</div>
                        <div className="mt-1 font-medium">Electrix Data</div>
                      </div>

                      <div>
                        <div className="text-slate-400">Industry / sector</div>
                        <div className="mt-1 font-medium">Software</div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="text-slate-400">Registered address</div>
                        <div className="mt-1 font-medium">Commercial Building, 317-319 Des Voeux Road, Central, Hong Kong</div>
                      </div>
                    </dl>
                  </div>

                  {/* Regional defaults: timezone/locale based on IP/browser; currency/fiscal/holidays removed */}
                  <div className="p-4 bg-transparent border border-white/6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">Regional & operational defaults</h3>
                    <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                      <div className="text-slate-400">Timezone</div>
                      <div className="font-medium">{detected?.timezone ?? 'Detecting...'}</div>

                      <div className="text-slate-400">Local time zone</div>
                      <div className="font-medium">
                        {(() => {
                          const tz = detected?.timezone
                          const locale = navigator.language || 'en-GB'
                          try {
                            if (tz) {
                              const formatted = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date())
                              return formatted
                            }
                          } catch (e) {
                            // fallback
                          }
                          // fallback: show local time string
                          return new Date().toLocaleString()
                        })()}
                      </div>

                      <div className="text-slate-400">Business hours</div>
                      <div className="font-medium">Mon–Fri 09:00–17:00</div>
                    </dl>
                  </div>
                </div>

                {/* Governance / compliance block full width */}
                <div className="mt-6 p-4 bg-transparent border border-white/6 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Governance & compliance</h3>
                  <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div className="text-slate-400">Data residency</div>
                    <div className="font-medium">Hong Kong / Dubai</div>

                    <div className="text-slate-400">Data retention</div>
                    <div className="font-medium">Inactive records are kept for 18 months</div>

                    <div className="text-slate-400">Audit log retention</div>
                    <div className="font-medium">1 year</div>

                    <div className="text-slate-400">Privacy contact</div>
                    <div className="font-medium">Careforce@electrixspace.com</div>

                    <div className="text-slate-400">Security defaults</div>
                    <div className="font-medium">MFA required: Yes · SSO enforced: No</div>
                  </dl>
                </div>

                
              </div>

              {/* Right column: quick metadata, system info, website */}
              <aside className="p-4 bg-transparent border border-white/6 rounded-2xl shadow-sm sticky top-24">
                <div className="mb-4">
                  <div className="text-sm text-slate-400">System</div>
                  <div className="font-medium">v0.1 prototype</div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-slate-400">Website</div>
                  <div className="font-medium"><a href="https://www.electrixdata.com" target="_blank" rel="noreferrer" className="text-indigo-300">www.electrixdata.com</a></div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-slate-400">Support</div>
                  <div className="font-medium">Careforce@electrixspace.com</div>
                </div>

                <div>
                  <div className="text-sm text-slate-400">Last config update</div>
                  <div className="font-medium">Today — prototype</div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {tab !== 'Organization' && (
          <div>
            {tab === 'Users & Access' ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-800">Users & Access</h2>
                    <div className="text-sm text-slate-500">Manage users, roles, teams and security settings.</div>
                  </div>

                  {/* header actions removed as requested */}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded-md" onClick={()=>setShowInvite(true)}>Add User Access</button>
                    <div className="text-sm text-slate-600">{users.length} users</div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {/* Single table in a scrollable container so columns align correctly */}
                    <div style={{ maxHeight: `${VISIBLE_ROWS * ROW_HEIGHT}px` }} className="overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-left">Email</th>
                            <th className="px-4 py-3 text-left">Role</th>
                            <th className="px-4 py-3 text-left">Team</th>
                            <th className="px-4 py-3 text-left">Last Login</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {users.map(u => (
                            <tr key={u.id} className="bg-white hover:bg-gray-50">
                              <td className="px-4 py-3 align-middle font-medium">{u.name}</td>
                              <td className="px-4 py-3 align-middle text-slate-600">{u.email}</td>
                              <td className="px-4 py-3 align-middle">{u.role}</td>
                              <td className="px-4 py-3 align-middle text-slate-600">{u.teams.join(', ') || '—'}</td>
                              <td className="px-4 py-3 align-middle text-slate-600">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
                              <td className="px-4 py-3 align-middle text-right space-x-2">
                                {u.status === 'Active' ? (
                                  <button onClick={()=>{
                                    setUsers(prev => prev.map(p => p.id===u.id ? {...p, status: 'Suspended'} : p))
                                    setActivityLogs(l => [{ id: `a_${Date.now()}`, text: `${u.name} suspended`, when: new Date().toLocaleString() }, ...l])
                                  }} className="px-3 py-1 rounded-md border text-sm text-red-600 bg-white hover:bg-red-50">Suspend</button>
                                ) : (
                                  <button onClick={()=>{
                                    setUsers(prev => prev.map(p => p.id===u.id ? {...p, status: 'Active'} : p))
                                    setActivityLogs(l => [{ id: `a_${Date.now()}`, text: `${u.name} reactivated`, when: new Date().toLocaleString() }, ...l])
                                  }} className="px-3 py-1 rounded-md border text-sm text-green-600 bg-white hover:bg-green-50">Reactivate</button>
                                )}

                                <button onClick={()=>{
                                  setUsers(prev => prev.filter(p => p.id!==u.id))
                                  setActivityLogs(l => [{ id: `a_${Date.now()}`, text: `${u.name} removed`, when: new Date().toLocaleString() }, ...l])
                                }} className="px-3 py-1 rounded-md border text-sm text-slate-700 bg-white hover:bg-gray-50">Remove</button>
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
                    <div className="mt-2 p-4 bg-white border border-gray-100 rounded-lg">
                      <h3 className="font-semibold">User account</h3>
                      <div className="mt-3 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">Enforce MFA</div>
                            <div className="text-xs text-slate-400">Require MFA for users</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">Require password reset at first login</div>
                            <div className="text-xs text-slate-400">Temporary passwords must be reset</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">SSO (optional)</div>
                            <div className="text-xs text-slate-400">Connect via SAML / OIDC</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="p-4 bg-white border border-gray-100 rounded-lg">
                    <h3 className="font-semibold">Activity Logs</h3>
                    <div className="mt-3 space-y-3 text-sm text-slate-600">
                      {activityLogs.slice(0,5).map(a => (
                        <div key={a.id} className="flex items-start justify-between">
                          <div>
                            <div className="text-sm">{a.text}</div>
                            <div className="text-xs text-slate-400">{a.when}</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      ))}
                      <div className="mt-2">
                        <button className="text-sm text-indigo-600" onClick={()=>alert('Export logs (demo)')}>Export activity logs</button>
                      </div>
                    </div>
                  </aside>
                </div>

                {/* Invite modal */}
                {showInvite && (
                  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                    <form onSubmit={inviteSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                      <h3 className="text-lg font-semibold mb-2 text-slate-800">Add User Access</h3>
                      <div className="text-sm text-slate-500 mb-4">A temporary password will be generated automatically. User will receive a reset link to set their own password.</div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-slate-600">Email</label>
                          <input required value={inviteData.email} onChange={(e)=>setInviteData(d=>({...d, email: e.target.value}))} className="mt-1 w-full rounded px-3 py-2 border border-gray-200" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
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
                      </div>
                      <div className="mt-4 flex items-center gap-2 justify-end">
                        <button type="button" className="text-sm text-slate-600" onClick={()=>setShowInvite(false)}>Cancel</button>
                        <button className="px-4 py-2 rounded-md bg-indigo-600 text-white">Create Access</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-6">
                <h2 className="text-xl font-semibold mb-3">{tab}</h2>
                <div className="text-sm text-slate-500">This section is scaffolded and will be implemented per your detailed spec.</div>
              </div>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  )
}
