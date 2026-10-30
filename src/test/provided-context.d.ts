// The values `vitest.config.ts` hands to tests through `provide`, read with `inject()`.
// tsconfig.node.json includes this file too, so the config's `provide` is checked against it.
export {}

declare module 'vitest' {
  interface ProvidedContext {
    cssText: { tailwindTheme: string; index: string }
  }
}
