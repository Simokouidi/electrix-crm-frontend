import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ActivitiesPage from './pages/ActivitiesPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import Shell from './components/Shell'
import { useStore } from './lib/store'
import { getAllowedSettingsTabs } from './lib/settingsTabs'

export default function App() {
  const { isAuthenticated, currentUser } = useStore()
  const role = String(currentUser?.role || '').toLowerCase()
  // Any role with at least one allowed settings tab can access /settings.
  // Users will be clamped to 'Organization' within SettingsPage.
  const canAccessSettings = getAllowedSettingsTabs(role).length > 0
  // If unauthenticated, render only the LoginPage (no Shell/sidebar) so nothing else is visible
  if(!isAuthenticated){
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/settings" element={canAccessSettings ? <SettingsPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  )
}
