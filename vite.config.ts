import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/varataaa/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // The custom-domain mount uses /varataaa/api, while the local Express
      // server exposes /api. Keep admin and checkout requests working when
      // testing the mounted route locally.
      '/varataaa/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/varataaa/, ''),
      },
    },
  },
});
