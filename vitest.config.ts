import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'path'
import { defineConfig } from 'vitest/config'

// Vitest's `?raw` import returns an empty string for a stylesheet, so CSS tests read the text
// here and get it through `inject('cssText')`.
const require = createRequire(import.meta.url)
const cssText = {
  tailwindTheme: readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8'),
  index: readFileSync(
    path.resolve(import.meta.dirname, './src/index.css'),
    'utf8',
  ),
}

// Tests run in Node without the app's Vite plugins. A component test opts in to jsdom with
// `// @vitest-environment jsdom` as its first line.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    provide: { cssText },
  },
})
