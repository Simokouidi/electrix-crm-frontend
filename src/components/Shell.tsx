import React from 'react'
import Sidebar from './Sidebar'
import { useStore } from '../lib/store'
import Button from './Button'
import AvatarCircle from './AvatarCircle'

type Props = { children: React.ReactNode }

export default function Shell({ children }: Props) {
  const { isAuthenticated, logout, currentUser } = useStore()

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Sidebar />
      </aside>
      <main className="content">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-end gap-3 mb-6">
            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2" title={`${currentUser?.name || ''} • ${currentUser?.email || ''} • ${(currentUser?.role || '').toString()}`}>
                  <AvatarCircle name={currentUser?.name || 'User'} avatarUrl={currentUser?.avatarUrl} />
                  <div className="hidden sm:flex flex-col leading-tight text-right">
                    <span className="text-sm font-medium text-slate-800">{currentUser?.name || 'User'}</span>
                    <span className="text-xs text-slate-500">{(currentUser?.role || '').toString()}</span>
                  </div>
                </div>
                <Button onClick={logout} className="bg-transparent text-slate-800 border border-gray-200 text-sm hover:bg-gray-100 transition">Logout</Button>
              </div>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
