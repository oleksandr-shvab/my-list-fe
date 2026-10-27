// The one place unexpected errors are reported. For now it logs; when the error tracker (Sentry)
// is added it is wired in here, and nothing else in the app changes.
export function reportError(error: unknown, context?: string): void {
  if (import.meta.env.DEV) {
    console.error(context ? `[${context}]` : '[error]', error)
  }
}
