import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: `npm run dev` (proxy /api -> collector :8080).
// Prod: `npm run build` outputs static files into ../frontend (served by FastAPI).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  build: { outDir: '../frontend', emptyOutDir: true },
})
