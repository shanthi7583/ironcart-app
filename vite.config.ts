import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { legacyCss } from './vite-legacy-css.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), legacyCss()],
})
