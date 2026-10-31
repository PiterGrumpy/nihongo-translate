# Nihon Translator

App web para traducir **japonés ↔ español** pensada para estudiar: no solo traduce, también
explica la frase parte a parte y su gramática, con furigana opcional y un diccionario de sesión
para guardar las palabras que quieres repasar.

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

## Variables de entorno

Todas viven en `.env` (copia de `.env.example`). Sin `GEMINI_API_KEY` la app arranca, pero
`/api/translate` responde `500`.

| Variable | Por defecto | Para qué |
|---|---|---|
| `AI_PROVIDER` | `gemini` | Proveedor de IA. Hoy solo `gemini` está implementado |
| `GEMINI_API_KEY` | — | **Obligatoria**. Se saca de <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Modelo principal (medido en 4–6 s) |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash` | Modelo de reserva. Vacío = sin reserva |
| `GEMINI_TIMEOUT_MS` | `15000` | Espera máxima por intento |
| `GEMINI_HEDGE_DELAY_MS` | `1500` | Espera antes de lanzar la reserva en paralelo |
| `GEMINI_THINKING_BUDGET` | vacío | Tokens de "pensamiento". Vacío = no se envía el campo |

La clave **nunca** se sube al repo ni llega al navegador: solo la lee el servidor de Vite
(o la Netlify Function, en la Etapa 5).

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

- **Direcciones**: `ja-to-es` y `es-to-ja`. El placeholder cambia, y el japonés que lleva
  furigana es el original al traducir desde japonés y la traducción al traducir desde español.
- **Una sola salida**: la tarjeta del modo enviado. No hay pestañas en la zona de resultados.
- Al cambiar de pestaña, la salida anterior **se queda** y no se relanza ninguna petición.
  La tarjeta lleva una etiqueta con el modo que la generó.
- **Furigana**: un interruptor global arriba a la derecha, **encendido por defecto**. Pinta
  `<ruby>` sobre el japonés (original en `ja-to-es`, traducción en `es-to-ja`). En el desglose
  la lectura va en su propia columna. Cambiarlo **no lanza peticiones**: la lectura ya viene
  en los segmentos de los tres modos. No se persiste: al recargar vuelve a encendido.
- **Caché** en memoria por (dirección, frase, modo): repetir una consulta es instantáneo y no
  gasta cupo. Se vacía al recargar la página.
- **Diccionario de sesión**: en **Desglose** y **Gramática**, cada palabra con significado lleva
  un botón **Guardar**. Al guardar aparece debajo de la tarjeta la sección plegable
  **Diccionario de sesión (N)**, con la palabra (con furigana), su lectura, su significado y
  **Quitar**. No duplica (`texto|lectura`), no llama a la IA y se vacía al recargar. En
  **Traductor** no hay botón porque la IA no devuelve significado en ese modo.

## Prueba rápida

1. `npm run dev` y abre <http://localhost:5173>.
2. En **Traductor**, pega `昨日は雨が降りましたが、今日は晴れています。` y pulsa **Traducir**.
3. Verás la lectura kana sobre los kanji. Apaga el interruptor **Furigana**: desaparece al
   instante y no se lanza ninguna petición.
4. Cambia a **Español → 日本語**, prueba `Ayer llovió, pero hoy hace sol.` y comprueba que el
   furigana sale ahora en la traducción japonesa.
5. Repite la misma frase en el mismo modo y dirección: la respuesta es instantánea (caché).
6. Cambia a **Desglose**, traduce `学校に行きます。` y pulsa **Guardar** en dos palabras:
   aparece abajo **Diccionario de sesión (2)**. Prueba **Ocultar/Mostrar** y **Quitar**.
7. Recarga la página: el diccionario vuelve a estar vacío (es de sesión, sin persistencia).

## Limitaciones conocidas

- La latencia del **free tier** de Gemini varía por momentos: la misma frase puede tardar 1 s o
  20 s. La app lo mitiga con carrera de modelos, timeout y contador de espera, pero no lo elimina.
- **Sin persistencia** en la V1: la caché, el diccionario de sesión y el estado del interruptor
  de furigana se pierden al recargar.
- Si la IA trocea la frase de forma que los segmentos no reconstruyen el texto, el furigana cae
  a texto plano a propósito: mejor sin lectura que con una frase rota.

## Estructura

```
nihon-translator/
├── README.md
├── package.json         scripts: dev / build / preview
├── package-lock.json    versiones exactas de las dependencias
├── tsconfig.json        TypeScript en modo estricto (incluye src/ y server/)
├── vite.config.ts       plugins de Vite + middleware POST /api/translate (dev y preview)
├── index.html           la única página; contiene <div id="root">
├── .env.example         plantilla de variables (sin valores reales)
├── .gitignore
├── server/
│   ├── translate.ts     validación de la petición + translate(): la puerta del endpoint
│   ├── prompts.ts       un prompt y un esquema JSON por modo (acumulativos)
│   ├── sanitize.ts      frontera de seguridad: valida la respuesta de la IA
│   └── providers/
│       ├── index.ts     askProvider(): elige proveedor según AI_PROVIDER
│       └── gemini.ts    llamada a Gemini, carrera de modelos, timeouts y errores
└── src/
    ├── main.tsx         arranque de React + providers (ajustes y diccionario)
    ├── index.css        Tailwind v4 + tokens propios
    ├── types.ts         contrato: Mode, Direction, Segment, TranslationResult
    ├── modes.ts         etiqueta, hint y color de cada modo
    ├── api.ts           requestTranslation(): fetch + errores + validación
    ├── cache.ts         caché en memoria por (dirección, modo, frase)
    ├── dictionary.ts    lógica pura del diccionario: añadir, deduplicar, quitar
    ├── SettingsContext.tsx   ajuste global: mostrar/ocultar furigana
    ├── DictionaryContext.tsx estado global del diccionario de sesión
    ├── App.tsx          pestañas, dirección, textarea, botón y estados
    └── components/
        ├── ResultCard.tsx   la única tarjeta de salida (+ botón Guardar)
        ├── Furigana.tsx     japonés con <ruby> (o texto plano si no cuadra)
        └── Dictionary.tsx   lista plegable de palabras guardadas
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
- ✅ **Etapa 4**: las cinco funcionalidades en pantalla.
  - ✅ Furigana global con `<ruby>` e interruptor (original en `ja-to-es`, traducción en `es-to-ja`).
  - ✅ Diccionario de sesión: guardar, listar y quitar palabras desde Desglose y Gramática.
- ⬜ **Etapa 5**: despliegue en Netlify (`netlify.toml`) y documentación final.

## Versiones

react 19.3.1 · vite 8.3.5 · typescript 7.0.2 · tailwindcss 4.3.3 (v4 no usa `tailwind.config.js`)
