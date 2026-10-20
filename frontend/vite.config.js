import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend target for local development. Overridable via VITE_BACKEND_URL.
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // Proxy /api -> FastAPI so the frontend uses relative URLs (no hardcoded host).
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
});
