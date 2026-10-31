import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './SettingsContext'
import './index.css'

// Punto de entrada: React toma el <div id="root"> de index.html y pinta <App /> dentro.
// StrictMode solo añade avisos extra en desarrollo; no afecta a producción.
// El provider envuelve toda la app: cualquier componente puede leer los ajustes globales.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
)
