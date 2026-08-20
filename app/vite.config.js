import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: o build funciona em qualquer subpasta do GitHub Pages
// sem precisar saber o nome do repositório de antemão.
export default defineConfig({
  base: './',
  plugins: [react()],
})
