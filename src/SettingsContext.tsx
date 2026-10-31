import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * Ajustes globales de la app.
 *
 * `showFurigana` es **uno solo para toda la app**: el original, la traducción y (más
 * adelante) el diccionario leen el mismo valor. Si cada componente tuviera su propio
 * interruptor, acabarían descoordinados.
 *
 * Vive en un contexto de React y no en `App` para no pasar la prop en cascada por
 * todos los componentes intermedios. En V1 no se persiste (ni `localStorage`): al
 * recargar vuelve al valor por defecto.
 */
type Settings = {
  showFurigana: boolean
  toggleFurigana: () => void
}

const SettingsContext = createContext<Settings | null>(null)

export function SettingsProvider({
  children,
  /** Valor inicial; solo lo usa la prueba de render. En la app arranca encendido. */
  initialShowFurigana = true,
}: {
  children: ReactNode
  initialShowFurigana?: boolean
}) {
  const [showFurigana, setShowFurigana] = useState(initialShowFurigana)

  return (
    <SettingsContext.Provider
      value={{ showFurigana, toggleFurigana: () => setShowFurigana((value) => !value) }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

/** Leer los ajustes desde cualquier componente. Falla claro si falta el provider. */
export function useSettings(): Settings {
  const settings = useContext(SettingsContext)
  if (!settings) throw new Error('useSettings debe usarse dentro de <SettingsProvider>.')
  return settings
}
