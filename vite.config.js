import { defineConfig } from 'vite';

// 삽질왕 Vite 빌드 설정 (Capacitor용 dist 폴더로 빌드)
export default defineConfig({
  root: 'src',
  base: './',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    open: true
  }
});
