import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DictionaryProvider } from './DictionaryContext'
import { SettingsProvider } from './SettingsContext'
import './index.css'

// Punto de entrada: React toma el <div id="root"> de index.html y pinta <App /> dentro.
// StrictMode solo añade avisos extra en desarrollo; no afecta a producción.
// Los providers envuelven toda la app: cualquier componente puede leer los ajustes
// globales (furigana) y el diccionario de sesión sin recibirlos por props.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <DictionaryProvider>
        <App />
      </DictionaryProvider>
    </SettingsProvider>
  </StrictMode>,
)
