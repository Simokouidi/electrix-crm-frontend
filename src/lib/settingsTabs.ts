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
