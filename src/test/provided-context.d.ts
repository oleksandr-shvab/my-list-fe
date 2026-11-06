// tsconfig.node.json includes this file too, so the `provide` in vitest.config.ts is type-checked.
export {}

declare module 'vitest' {
  interface ProvidedContext {
    cssText: { tailwindTheme: string; index: string }
  }
}
