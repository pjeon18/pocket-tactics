import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Pages the app is served from /<repo>/, so the CI build passes
// BASE_PATH=/pocket-tactics/. Locally it defaults to '/'. All public assets are
// referenced through import.meta.env.BASE_URL so they resolve under either.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
