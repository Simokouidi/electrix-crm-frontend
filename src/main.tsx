import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { StoreProvider } from './lib/store'

// Import the Electrix logo so Vite will resolve and copy it to the build output
import logoUrl from './Images/Logo_copy2.png'

// Ensure a favicon is present in the page head (works both in dev and after build)
if (typeof document !== 'undefined') {
  const existing = document.querySelector("link[rel*='icon']")
  const link = existing || document.createElement('link')
  link.type = 'image/png'
  link.rel = 'icon'
  link.href = logoUrl as unknown as string
  if (!existing) document.getElementsByTagName('head')[0].appendChild(link)
  document.title = 'ELECTRIX CRM'
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
