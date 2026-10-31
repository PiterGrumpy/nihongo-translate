# Nihon Translator

App web para traducir **japonés ↔ español** pensada para estudiar: no solo traduce, también
explica la frase parte a parte y su gramática, con furigana opcional.

Proyecto de aprendizaje: cada etapa se puede arrancar y probar antes de pasar a la siguiente.

## Requisitos

- Node 22+ y npm (probado con `node v22.22.1` y `npm 9.2.0`).

## Arrancar

```bash
cd proyectos/nihon-translator
npm install        # solo la primera vez
cp .env.example .env   # y pega tu GEMINI_API_KEY dentro (nunca se sube al repo)
npm run dev        # http://localhost:5173
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Comprueba los tipos (`tsc --noEmit`) y genera `dist/` |
| `npm run preview` | Sirve el resultado de `build` para revisarlo |

## Cómo funciona la interfaz

Tres pestañas que funcionan como **modos**. No son vistas del mismo dato: cada una hace su
propia petición con un prompt distinto.

| Modo | Lo que se pide | Lo que se muestra |
|---|---|---|
| Traductor | Traducción + segmentos con lectura kana | Original y traducción |
| Desglose | Lo anterior + significado de cada palabra | + tabla palabra / lectura / significado |
| Gramática | Lo anterior + explicación gramatical | + explicación (el modo más completo) |

Son acumulativos: `grammar` ⊃ `breakdown` ⊃ `translate`.

Reglas ya decididas:

- **Una sola salida**: la tarjeta del modo enviado. No hay pestañas en la zona de resultados.
- Al cambiar de pestaña, la salida anterior **se queda** y no se relanza ninguna petición.
  La tarjeta lleva una etiqueta con el modo que la generó.
- **Furigana**: un interruptor global. Si está activo, todo kanji lleva su lectura kana en
  cualquier modo. La lectura la devuelve la IA en los segmentos, así que los tres prompts
  la piden aunque el modo no la pinte.
- Caché en memoria por (dirección, frase, modo) para no repetir llamadas ni gastar cupo.

## Estructura

```
nihon-translator/
├── AGENTS.md            reglas del proyecto para el agente
├── contexto.md          estado, arranque y siguiente paso
├── memoria.md           decisiones y su porqué
├── index.html           la única página; contiene <div id="root">
├── vite.config.ts       plugins de Vite + middleware POST /api/translate (dev y preview)
├── tsconfig.json        TypeScript en modo estricto (incluye src/ y server/)
├── .env.example         variables previstas (sin valores reales)
├── server/
│   ├── translate.ts     validación de la petición + translate(): la puerta del endpoint
│   ├── prompts.ts       un prompt y un esquema JSON por modo (acumulativos)
│   ├── sanitize.ts      frontera de seguridad: valida la respuesta de la IA
│   └── providers/
│       ├── index.ts     askProvider(): elige proveedor según AI_PROVIDER
│       └── gemini.ts    llamada a Gemini, carrera de modelos, timeouts y errores
└── src/
    ├── main.tsx         arranque de React
    ├── index.css        Tailwind v4 + tokens propios
    ├── types.ts         contrato: Mode, Direction, Segment, TranslationResult
    ├── modes.ts         etiqueta, hint y color de cada modo
    ├── api.ts           requestTranslation(): fetch + errores + validación
    ├── cache.ts         caché en memoria por (dirección, modo, frase)
    ├── App.tsx          pestañas, dirección, textarea, botón y estados
    └── components/
        └── ResultCard.tsx   la única tarjeta de salida
```

## API local

`POST /api/translate` llama de verdad a Gemini y devuelve un `TranslationResult`.
Lo monta un plugin de `vite.config.ts` (con el `.env` cargado), así que funciona con
`npm run dev` y con `npm run preview`. La clave **nunca** viaja al navegador.

```bash
curl -X POST http://localhost:5173/api/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"学校に行きます。","mode":"grammar","direction":"ja-to-es"}'
```

Modos: `translate`, `breakdown`, `grammar` (acumulativos). Direcciones: `ja-to-es`, `es-to-ja`.

| Caso | Respuesta |
|---|---|
| POST válido | `200` con `TranslationResult` |
| Texto vacío / > 500 caracteres / modo o dirección desconocidos / JSON inválido / cuerpo > 10 KB | `400` |
| Método distinto de POST | `405` |
| Falta `GEMINI_API_KEY` o proveedor desconocido | `500` |
| La IA rechaza la petición (modelo inexistente, respuesta incompleta) | `502` |
| Modelo saturado o cupo agotado (429/503) | `503` |
| Ningún modelo contesta a tiempo | `504` |

Todos los errores son `{ error: string }` con un mensaje en español; el detalle técnico de
Google se queda en el log del servidor.

## IA

Se usa la **capa gratuita de la API de Gemini**. Modelo de trabajo: `gemini-3.5-flash-lite`
(medido en 4–6 s incluso con el prompt de gramática y frases largas). Modelo de reserva:
`gemini-3.5-flash`.

- **Carrera de modelos**: si el principal no contesta en `GEMINI_HEDGE_DELAY_MS` (1,5 s), el de
  reserva sale en paralelo y gana el primero que termine; el otro se cancela. Si el principal
  falla de inmediato (503), la reserva sale sin esperar.
- **Timeout por intento**: `GEMINI_TIMEOUT_MS` (15 s). La app nunca se queda colgada.
- **Respuestas saneadas** en `server/sanitize.ts`: si la IA devuelve menos campos de los que
  pide el modo, es un error claro, no un `undefined` en pantalla.
- La clave vivirá **solo** en el servidor (Netlify Functions). Nunca en el navegador.
- No usar Gemma (solo free tier, 16k tokens/minuto) ni `gemini-4-argon` / Pro (no existen en free tier).
- Límites reales: <https://aistudio.google.com/rate-limit> (por proyecto, no por clave).
- En free tier los prompts se usan para mejorar los productos de Google: no meter datos sensibles.
- La latencia del free tier **varía por momentos** (el mismo modelo y frase pueden tardar 1 s o
  20 s por la cola de Google). No es algo que el código pueda fijar.

## Estado

- ✅ **Etapa 1**: esqueleto que arranca (pestañas, dirección, botón, tarjeta de salida).
- ✅ **Etapa 2**: contrato definitivo + `/api/translate` con datos falsos, interfaz conectada y
  segmentos en pantalla (original · traducción · palabra por palabra · gramática).
- ✅ **Etapa 3**: IA real (Gemini detrás de `/api/translate`), con carrera de modelos, saneado
  de respuestas, caché en memoria y contador de espera.
- ⬜ **Etapa 4**: las cinco funcionalidades en pantalla, una a una (incluye furigana y diccionario).
- ⬜ **Etapa 5**: despliegue en Netlify (`netlify.toml`) y documentación final.

## Versiones

react 19.3.1 · vite 8.3.5 · typescript 7.0.2 · tailwindcss 4.3.3 (v4 no usa `tailwind.config.js`)
