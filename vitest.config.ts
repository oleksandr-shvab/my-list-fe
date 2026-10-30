import { readFileSync } from 'node:fs'
import path from 'path'
import { defineConfig } from 'vitest/config'

// Vitest's `?raw` import gives an empty string for a stylesheet, so the CSS tests get the text
// from here (Node, outside the app's type check) through `inject('cssText')`.
const cssText = {
  tailwindTheme: readFileSync(
    path.resolve(import.meta.dirname, './node_modules/tailwindcss/theme.css'),
    'utf8',
  ),
  index: readFileSync(
    path.resolve(import.meta.dirname, './src/index.css'),
    'utf8',
  ),
}

// Unit tests run in plain Node; the app's Vite plugins (router, Tailwind) are not needed.
// A component test opts in to jsdom with `// @vitest-environment jsdom` as its first line.
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
