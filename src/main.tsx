import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { StoreProvider } from './lib/store'

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
