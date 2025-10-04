export const SETTINGS_TABS = [
  'Organization',
  'Users & Access',
  'Pipelines',
  'Routing & SLAs',
  'Sequences',
  'Messaging & Calendars',
  'Notifications',
  'Data',
  'Automation',
  'Audit & Security',
  'Billing',
  'Environments'
]

export type SettingsTab = (typeof SETTINGS_TABS)[number]

// Return the list of tabs a role is allowed to see
export function getAllowedSettingsTabs(role?: string): SettingsTab[] {
  const r = String(role || '').toLowerCase()
  if(r === 'owner') return SETTINGS_TABS as SettingsTab[]
  if(r === 'admin') return ['Organization', 'Users & Access'] as SettingsTab[]
  return ['Organization'] as SettingsTab[]
}
