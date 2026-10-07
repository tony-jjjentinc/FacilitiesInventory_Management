import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative asset paths ('./') work from any host path: the domain root (Cloudflare Pages / Workers, custom domains)
// and a sub-path (GitHub Pages /FacilitiesInventory_Management/). The app uses HashRouter, so no server-side
// routing depends on the base. Set VITE_BASE to force an absolute base if ever needed.
const base = process.env.VITE_BASE ?? './'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
})
