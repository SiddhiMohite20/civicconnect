import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API + websockets so cookies are first-party (same origin as the Vite server).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
