import path from 'path'
import { defineConfig } from 'vitest/config'

// Unit tests run in plain Node; the app's Vite plugins (router, Tailwind) are not needed.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
})
