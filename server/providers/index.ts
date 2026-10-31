import type { Prompt } from '../prompts.ts'
import { askGemini, ProviderError, type ProviderEnv } from './gemini.ts'

export { ProviderError }
export type { ProviderEnv }

/**
 * Selector de proveedor. Cambiar de IA = cambiar `AI_PROVIDER` en `.env`, no la interfaz
 * ni el resto del servidor.
 *
 * Hoy solo existe Gemini. Añadir OpenAI mañana es crear `providers/openai.ts` con la
 * misma firma y un `case` más aquí.
 */
export function askProvider(prompt: Prompt, env: ProviderEnv): Promise<unknown> {
  if (env.provider === 'gemini') return askGemini(prompt, env)

  throw new ProviderError(
    `Proveedor de IA desconocido: "${env.provider}". Solo "gemini" está implementado.`,
    500,
  )
}
