const RELOAD_FLAG = 'chunk-reload-attempted'

// After a deploy, an open tab asks for lazy chunks that no longer exist and Vite emits
// `vite:preloadError`. Reload once to pick up the new version; the flag stops a reload loop when
// the problem is something else (the network, a broken deploy).
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
