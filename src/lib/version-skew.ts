const RELOAD_FLAG = 'chunk-reload-attempted'

// After a deploy, an open tab requests lazy chunks that no longer exist and Vite emits
// `vite:preloadError`. Reload once; the flag stops a reload loop when the cause is something else.
export function reloadOnceAfterFailedChunk(): void {
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (sessionStorage.getItem(RELOAD_FLAG)) return
      sessionStorage.setItem(RELOAD_FLAG, '1')
    } catch {
      return
    }
    event.preventDefault()
    window.location.reload()
  })
}
