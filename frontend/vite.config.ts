import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Dev: Vite on 5173, proxy /api → Express (3000 local, override via VITE_API_TARGET).
// The app calls same-origin `/api/...`; the proxy strips the prefix.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    // 5173 is often taken on this machine (another local dev app) — pin a
    // deterministic free port and fail loudly instead of silently drifting.
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
