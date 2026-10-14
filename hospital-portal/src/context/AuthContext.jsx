/**
 * Authentication context.
 *
 * Mirrors the main frontend's conventions: tokens + user in localStorage under
 * access_token / refresh_token / user; login uses the shared /auth/login
 * endpoint and stores { access_token, refresh_token, user }.
 *
 * On boot, if a token exists we verify it via /auth/me. Org membership/context
 * is handled separately by OrgContext (it depends on a valid token).
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import { tokenStore } from '../api/storage'

const AuthContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(tokenStore.getUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const token = tokenStore.getAccess()
      if (token) {
        try {
          const res = await authApi.getMe()
          const me = res.user || res
          setUser(me)
          tokenStore.setUser(me)
        } catch {
          tokenStore.clear()
          setUser(null)
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = async (email, password) => {
    try {
      const res = await authApi.login({ email, password })
      tokenStore.setTokens({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      })
      tokenStore.setUser(res.user)
      setUser(res.user)
      return { success: true }
    } catch (err) {
      const message =
        err.response?.data?.message || err.response?.data?.error || 'Login failed'
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore network errors during logout
    } finally {
      tokenStore.clear()
      setUser(null)
    }
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!tokenStore.getAccess(),
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
