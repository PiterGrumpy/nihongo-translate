/**
 * Diccionario de sesión: las palabras que el usuario guarda mientras estudia.
 *
 * Es lógica pura, sin React ni red: recibe una lista y devuelve otra. Así se puede
 * probar sin navegador (igual que `cache.ts`) y el contexto de React solo se encarga
 * de guardar el resultado en el estado.
 *
 * Decisiones de la V1:
 * - Se guarda la palabra, su lectura kana y su significado. No la frase de origen.
 * - La clave de duplicado es `texto|lectura`, no solo el texto: `橋` puede leerse
 *   `はし` (puente) o `きょう` (hoy), y son palabras distintas que conviene repasar.
 * - Tope de 200 entradas para que una sesión muy larga no crezca sin control. Si se
 *   llena, se descarta la más antigua (el orden es de más vieja a más nueva).
 * - Vive solo en memoria: al recargar se vacía (sin `localStorage`, como el resto de V1).
 */

/** Una palabra guardada. `meaning` siempre existe: sin significado no se guarda. */
export type DictionaryEntry = {
  text: string
  reading?: string
  meaning: string
}

/** Tope defensivo, igual que el de la caché. */
const MAX_ENTRIES = 200

/** Identidad de una palabra: el texto y su lectura, sin espacios sobrantes. */
export function entryKey(word: Pick<DictionaryEntry, 'text' | 'reading'>): string {
  return `${word.text.trim()}|${(word.reading ?? '').trim()}`
}

/** ¿Está ya esta palabra en la lista? */
export function hasEntry(
  entries: DictionaryEntry[],
  word: Pick<DictionaryEntry, 'text' | 'reading'>,
): boolean {
  const key = entryKey(word)
  return entries.some((entry) => entryKey(entry) === key)
}

/**
 * Añade una palabra al final. Devuelve la **misma lista** si no hay nada que hacer
 * (sin texto, sin significado o ya guardada), para que React no vuelva a pintar.
 */
export function addEntry(entries: DictionaryEntry[], word: DictionaryEntry): DictionaryEntry[] {
  const text = word.text.trim()
  const meaning = word.meaning.trim()
  if (!text || !meaning) return entries

  const reading = word.reading?.trim()
  const entry: DictionaryEntry = reading ? { text, reading, meaning } : { text, meaning }

  if (hasEntry(entries, entry)) return entries

  const next = [...entries, entry]
  return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
}

/** Quita la palabra con esa clave. Devuelve la misma lista si no estaba. */
export function removeEntry(entries: DictionaryEntry[], key: string): DictionaryEntry[] {
  if (!entries.some((entry) => entryKey(entry) === key)) return entries
  return entries.filter((entry) => entryKey(entry) !== key)
}
