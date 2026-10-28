// Shown when a page waits for the sign-in check and the answer is slow.
export function PendingScreen() {
  return (
    <div className="flex min-h-[50svh] flex-1 items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  )
}
