import React from 'react'
import Logo from '../Images/Logo_copy2.png'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { SETTINGS_TABS } from '../lib/settingsTabs'
// lucide-react exports vary between versions; use a loose 'any' for icon components to avoid type issues
import {
  Briefcase,
  Users as UsersIcon,
  Layers,
  MapPin,
  Repeat,
  MessageSquare,
  Bell,
  Database,
  Zap,
  Shield,
  CreditCard,
  Globe,
  Home,
  Users,
  FileText,
  Settings as SettingsIcon,
} from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/activities', label: 'Activities', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Sidebar(): JSX.Element {
  const {
    showSettingsSections,
    setShowSettingsSections,
    setSelectedSettingsTab,
    selectedSettingsTab,
  } = useStore()

  const nav = useNavigate()
  const location = useLocation()
  const onSettingsRoute =
    location.pathname === '/settings' || location.pathname.startsWith('/settings/')

  const iconMap: Record<string, any> = {
    Organization: Briefcase,
    'Users & Access': UsersIcon,
    Pipelines: Layers,
    'Routing & SLAs': MapPin,
    Sequences: Repeat,
    'Messaging & Calendars': MessageSquare,
    Notifications: Bell,
    Data: Database,
    Automation: Zap,
    'Audit & Security': Shield,
    Billing: CreditCard,
    Environments: Globe,
  }

  return (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-3">
        <img src={Logo} alt="Logo" className="w-10 h-10 object-contain" />
        <div className="text-lg font-semibold">CRM</div>
      </div>

      <ul className="mt-8 space-y-2 flex-1" role="menu">
        {links.map((l) => {
          const Icon = l.icon
          return (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }: { isActive: boolean }) =>
                  `group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium nav-link ` +
                  (isActive
                    ? 'bg-gradient-to-r from-accentFrom to-accentTo shadow-[0_8px_24px_rgba(99,102,241,0.12)]'
                    : 'hover:bg-white/5')
                }
              >
                <span className="w-4 h-4 text-white/90">
                  <Icon size={18} />
                </span>
                <span>{l.label}</span>
              </NavLink>

              {l.to === '/settings' && onSettingsRoute && (
                <div className="pl-3 mt-2 flex flex-col items-start">
                  <button
                    className="text-xs text-white/70 hover:text-white/90 px-3 py-1.5 rounded-md bg-white/5 mb-2"
                    onClick={(e) => {
                      e.preventDefault()
                      setShowSettingsSections((s: boolean) => !s)
                    }}
                  >
                    {showSettingsSections ? 'Hide sections' : 'Show sections'}
                  </button>

                  {showSettingsSections && (
                    <div className="mt-0.5 rounded-2xl shadow-inner bg-white/4" style={{ minWidth: 200 }}>
                      <div className="px-2 py-1.5">
                        <div className="space-y-0.5">
                          {SETTINGS_TABS.map((st) => {
                            const IconComp = iconMap[st] || Briefcase
                            const active = selectedSettingsTab === st
                            return (
                              <button
                                key={st}
                                onClick={(e) => {
                                  e.preventDefault()
                                  setSelectedSettingsTab(st)
                                  nav('/settings')
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${
                                  active ? 'bg-white/10 text-white font-semibold' : 'hover:bg-white/5 text-white/80'
                                }`}
                                aria-current={active ? 'true' : undefined}
                              >
                                <span className={`w-6 h-6 flex items-center justify-center ${active ? 'text-indigo-300' : 'text-white/70'}`}>
                                  <IconComp size={18} />
                                </span>
                                <span className="flex-1 text-sm text-left">{st}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-4 text-sm text-white/70">v0.1 prototype</div>
    </nav>
  )
}
