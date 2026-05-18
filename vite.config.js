import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement depuis .env
  const env = loadEnv(mode, process.cwd(), '')
  const groqApiKey = env.VITE_GROQ_API_KEY

  console.log('[Vite] Clé Groq chargée :', groqApiKey ? '✅ oui' : '❌ non')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (path) => '/openai/v1/chat/completions',
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Ajoute la clé API dans l'en-tête Authorization
              if (groqApiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${groqApiKey}`)
              } else {
                console.error('[Proxy] ⚠️ Clé Groq manquante !')
              }
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          }
        }
      }
    }
  }
})