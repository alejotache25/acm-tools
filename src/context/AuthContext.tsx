import { createContext, useContext, useState, ReactNode } from 'react';
import type { AuthUser } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('acm_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (u: AuthUser) => {
    setUser(u);
    localStorage.setItem('acm_user', JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('acm_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
