import React from 'react'
import Sidebar from './Sidebar'
import { useStore } from '../lib/store'
import Button from './Button'

type Props = { children: React.ReactNode }

export default function Shell({ children }: Props) {
  const { isAuthenticated, logout } = useStore()

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Sidebar />
      </aside>
      <main className="content">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-end mb-6">
            {isAuthenticated && <Button onClick={logout} className="bg-transparent text-slate-800 border border-gray-200 text-sm hover:bg-gray-100 transition">Logout</Button>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
