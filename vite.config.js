import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    // ✅ Proxy pour football-data.org (évite les problèmes CORS)
    proxy: {
      '/api/football-data': {
        target: 'https://api.football-data.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/football-data/, '/v4'),
        headers: {
          'X-Auth-Token': process.env.VITE_FOOTBALL_DATA_API_KEY || ''
        }
      }
    }
  },
  // ✅ Configuration de build pour production
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
})