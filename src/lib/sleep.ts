// Waits `ms`, or rejects at once when the signal aborts, so a caller that was cancelled does not linger.
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
    }
    const cancel = () => {
      done()
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      done()
      resolve()
    }, ms)
    signal.addEventListener('abort', cancel, { once: true })
  })
}
