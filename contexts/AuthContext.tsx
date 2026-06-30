'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { parseJwt } from '@/lib/utils'

interface AuthState {
  token: string
  userId: string
  userName: string
  userRole: string
}

interface LoginData {
  accessToken?: string
  token?: string
  name?: string
  username?: string
  userId?: string
  role?: string
}

interface AuthContextType extends AuthState {
  login: (data: LoginData) => void
  logout: () => void
  isLoaded: boolean
}

const AuthContext = createContext<AuthContextType>({
  token: '', userId: '', userName: '', userRole: '',
  login: () => {}, logout: () => {}, isLoaded: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: '', userId: '', userName: '', userRole: '' })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('sjk_tok') || ''
    setAuth({
      token: t,
      userId: localStorage.getItem('sjk_uid') || '',
      userRole: localStorage.getItem('sjk_role') || '',
      userName: localStorage.getItem('sjk_name') || '',
    })
    setIsLoaded(true)
  }, [])

  function login(data: LoginData) {
    const token = data.accessToken || data.token || ''
    const claims = parseJwt(token)

    const userId = (claims?.sub as string) || data.userId || ''
    let role = (claims?.role as string) || data.role || ''
    if (!role) {
      const realmRoles = (claims?.realm_access as { roles?: string[] })?.roles || []
      const sysRoles = ['SELLER', 'BUYER', 'MANAGER', 'MASTER']
      for (const r of realmRoles) {
        if (sysRoles.includes(r)) { role = r; break }
      }
    }
    const userName = (claims?.preferred_username as string) || data.name || data.username || ''

    setAuth({ token, userId, userRole: role, userName })
    localStorage.setItem('sjk_tok', token)
    localStorage.setItem('sjk_uid', userId)
    localStorage.setItem('sjk_role', role)
    localStorage.setItem('sjk_name', userName)
  }

  function logout() {
    setAuth({ token: '', userId: '', userRole: '', userName: '' })
    localStorage.clear()
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isLoaded }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
