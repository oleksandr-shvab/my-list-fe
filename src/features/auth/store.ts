import { create } from 'zustand'
import type { User } from './types'

type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated'

type AuthState = {
  user: User | null
  status: AuthStatus
  setUser: (user: User) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) => set({ user, status: 'authenticated' }),
  clearUser: () => set({ user: null, status: 'unauthenticated' }),
}))
