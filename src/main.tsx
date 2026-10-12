import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'
import App from './App.tsx'
import { SystemProvider } from './context/SystemContext'
import { ToastProvider } from './context/ToastContext'

// a page chunk that no longer exists (a new version was deployed while this tab was open): load the new version
window.addEventListener('vite:preloadError', () => window.location.reload());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SystemProvider>
  </StrictMode>,
)
