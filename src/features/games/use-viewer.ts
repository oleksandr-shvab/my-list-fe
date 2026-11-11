import { useSession } from '@/features/auth/session'
import { useMergeSettled } from './guest-merge'
import { GUEST_VIEWER, UNCONFIRMED_VIEWER, type Viewer } from './view-queries'

// Whose game a screen shows, for its query keys; a failed check is 'unconfirmed', not a guest. `ready` is false until the
// check has answered or failed (R-2), and for an account until this browser's games have been moved into it (AC-100).
export function useViewer(): { viewer: Viewer; ready: boolean } {
  const session = useSession()
  const mergeSettled = useMergeSettled(session)
  const viewer =
    session.user?.id ??
    (session.status === 'guest' ? GUEST_VIEWER : UNCONFIRMED_VIEWER)
  return { viewer, ready: session.status !== 'pending' && mergeSettled }
}
