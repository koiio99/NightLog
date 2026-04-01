import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), mkcert()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist'
  }
})