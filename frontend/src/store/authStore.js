import { create } from 'zustand'

const stored = () => {
  try {
    const user = localStorage.getItem('voz_user')
    const token = localStorage.getItem('voz_token')
    return { user: user ? JSON.parse(user) : null, token: token || null }
  } catch {
    return { user: null, token: null }
  }
}

export const useAuthStore = create((set) => ({
  ...stored(),

  login: (user, token) => {
    localStorage.setItem('voz_user', JSON.stringify(user))
    localStorage.setItem('voz_token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('voz_user')
    localStorage.removeItem('voz_token')
    set({ user: null, token: null })
  },
}))
