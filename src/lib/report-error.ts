// The one place unexpected errors are reported. Wire the error tracker in here.
export function reportError(error: unknown, context?: string): void {
  if (import.meta.env.DEV) {
    console.error(context ? `[${context}]` : '[error]', error)
  }
}
