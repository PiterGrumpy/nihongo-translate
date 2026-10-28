import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// El servidor de desarrollo: Vite sirve la app en http://localhost:5173
// En la Etapa 2 añadiremos aquí el montaje de /api/translate.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
