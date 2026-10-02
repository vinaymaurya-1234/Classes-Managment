import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In local development, keep the browser on :5173 and proxy /api to Express :5000.
// Production can set VITE_API_BASE_URL to the deployed API origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
