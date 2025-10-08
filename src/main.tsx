import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { StoreProvider } from './lib/store'
const loginBgUrl = new URL('./Images/Background.png', import.meta.url).href

// Import the Electrix logo so Vite will resolve and copy it to the build output
import logoUrl from './Images/Logo_copy2.png'

// Ensure a favicon is present in the page head (works both in dev and after build)
if (typeof document !== 'undefined') {
  // Query for an existing favicon link and cast it to HTMLLinkElement for TS
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link') as HTMLLinkElement
    link.type = 'image/png'
    link.rel = 'icon'
    link.href = logoUrl as unknown as string
    document.head.appendChild(link)
  } else {
    // update existing
    link.href = logoUrl as unknown as string
    link.type = 'image/png'
    link.rel = 'icon'
  }
  document.title = 'ELECTRIX CRM'

  // Preload the login background image so it is available immediately
  try {
    const preload = document.createElement('link') as HTMLLinkElement
    preload.rel = 'preload'
    preload.setAttribute('as', 'image')
    preload.href = loginBgUrl as unknown as string
    preload.setAttribute('fetchpriority', 'high')
    document.head.appendChild(preload)
  } catch {}

  // Preload all app images on initial load by injecting <link rel="preload"> tags
  try {
    const imageUrls: string[] = [
      new URL('./Images/Background.png', import.meta.url).href,
      new URL('./Images/Logo_copy2.png', import.meta.url).href,
      new URL('./Images/reset-arrows.svg', import.meta.url).href,
      new URL('./Images/(unassigned).png', import.meta.url).href,
      new URL('./Images/Call client.png', import.meta.url).href,
      new URL('./Images/Email client.png', import.meta.url).href,
      new URL('./Images/Follow-up.png', import.meta.url).href,
      new URL('./Images/Prepare contract.png', import.meta.url).href,
      new URL('./Images/Schedule meeting.png', import.meta.url).href,
      new URL('./Images/Send proposal.png', import.meta.url).href,
    ]

    const ensurePreload = (href: string) => {
      if (!href) return
      // Avoid duplicates
      const exists = document.querySelector(`link[rel="preload"][href="${href}"]`)
      if (exists) return
      const l = document.createElement('link') as HTMLLinkElement
      l.rel = 'preload'
      l.setAttribute('as', 'image')
      l.href = href
      l.setAttribute('fetchpriority', 'high')
      document.head.appendChild(l)
    }

    imageUrls.forEach(u => { try { ensurePreload(u) } catch {} })
  } catch {}
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <StoreProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StoreProvider>
  )
}
