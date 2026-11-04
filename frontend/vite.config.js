import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { generatePrerenderedFiles } from './scripts/prerender.mjs'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'
  const publicSiteUrl = process.env.PUBLIC_SITE_URL ?? environment.PUBLIC_SITE_URL

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'static-prerender-seo',
        async closeBundle() {
          await generatePrerenderedFiles({ publicSiteUrl })
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 9000,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: false,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      exclude: ['**/node_modules/**', 'e2e/**'],
      coverage: {
        provider: 'v8',
        all: true,
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/main.jsx'],
        reporter: ['text', 'html', 'json'],
        thresholds: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  }
})
