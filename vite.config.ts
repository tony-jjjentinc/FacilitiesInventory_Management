import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Asset base path:
//  - GitHub Pages serves the app from a sub-path (/FacilitiesInventory_Management/).
//  - Cloudflare Pages serves it from the domain root, so the base must be '/'. Cloudflare sets CF_PAGES=1 during
//    its builds; set VITE_BASE yourself to override either default (e.g. VITE_BASE=/ for any root-hosted deploy).
const base = process.env.VITE_BASE ?? (process.env.CF_PAGES ? '/' : '/FacilitiesInventory_Management/')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
})
