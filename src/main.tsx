import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { StoreProvider } from './lib/store'
import loginBgUrl from './Images/Background.png'

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
