/**
 * AuthContext
 * 
 * @description Global authentication state yönetimi
 * @usage const { user, login, logout, updateUser } = useAuth();
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSessionCheckIn: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  setHasSessionCheckIn: (value: boolean) => void;
  requiresCheckIn: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CHECK_IN_SESSION_KEY = 'cafeduo_checked_in_user_id';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSessionCheckIn, setHasSessionCheckInState] = useState(false);

  /**
   * Sayfa yenilendiğinde session'ı restore et
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedCheckInUserId = sessionStorage.getItem(CHECK_IN_SESSION_KEY);

        // Cache-first hydrate for snappy UI
        const cachedUserRaw = localStorage.getItem('cafe_user');
        if (cachedUserRaw) {
          try {
            const cachedUser = JSON.parse(cachedUserRaw) as User;
            if (cachedUser?.id) {
              setUser(cachedUser);
              // Restore check-in state
              const hasStoredCheckIn = storedCheckInUserId === String(cachedUser.id);
              if (cachedUser.isAdmin || cachedUser.role === 'cafe_admin') {
                setHasSessionCheckInState(true);
              } else {
                const table = String(cachedUser.table_number || '').trim().toUpperCase();
                const hasTable = Boolean(table) && table !== 'NULL' && table !== 'UNDEFINED';
                setHasSessionCheckInState(hasStoredCheckIn && Boolean(cachedUser.cafe_id) && hasTable);
              }
            }
          } catch (parseErr) {
            console.warn('Cached user parse failed, clearing stale cache.', parseErr);
            localStorage.removeItem('cafe_user');
          }
        }
        
        // Verify token with backend
        const userData = await api.auth.verifyToken();
        if (userData) {
          setUser(userData);
          localStorage.setItem('cafe_user', JSON.stringify(userData));
          
          // Update check-in state
          const hasStoredCheckIn = storedCheckInUserId === String(userData.id);
          if (userData.isAdmin || userData.role === 'cafe_admin') {
            setHasSessionCheckInState(true);
          } else {
            const table = String(userData.table_number || '').trim().toUpperCase();
            const hasTable = Boolean(table) && table !== 'NULL' && table !== 'UNDEFINED';
            setHasSessionCheckInState(hasStoredCheckIn && Boolean(userData.cafe_id) && hasTable);
          }
        } else {
          // Session geçersiz
          localStorage.removeItem('cafe_user');
          sessionStorage.removeItem(CHECK_IN_SESSION_KEY);
          setUser(null);
          setHasSessionCheckInState(false);
        }
      } catch (err) {
        console.error('Session restore failed:', err);
        localStorage.removeItem('cafe_user');
        sessionStorage.removeItem(CHECK_IN_SESSION_KEY);
        setUser(null);
        setHasSessionCheckInState(false);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  /**
   * Login işlemi
   */
  const login = useCallback((userData: User) => {
    localStorage.setItem('cafe_user', JSON.stringify(userData));
    setUser(userData);
    setHasSessionCheckInState(userData.isAdmin || userData.role === 'cafe_admin');
  }, []);

  /**
   * Logout işlemi
   */
  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('cafe_user');
      sessionStorage.removeItem(CHECK_IN_SESSION_KEY);
      setUser(null);
      setHasSessionCheckInState(false);
    }
  }, []);

  /**
   * Kullanıcı bilgilerini güncelle (local)
   */
  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem('cafe_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Kullanıcı bilgilerini server'dan yenile
   */
  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const userData = await api.users.get(user.id.toString());
      if (userData) {
        setUser(userData);
        localStorage.setItem('cafe_user', JSON.stringify(userData));
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [user?.id]);

  /**
   * Check-in state setter
   */
  const setHasSessionCheckIn = useCallback((value: boolean) => {
    setHasSessionCheckInState(value);
    const currentUserId = user?.id ? String(user.id) : '';
    if (value && currentUserId) {
      sessionStorage.setItem(CHECK_IN_SESSION_KEY, currentUserId);
    } else {
      sessionStorage.removeItem(CHECK_IN_SESSION_KEY);
    }
  }, [CHECK_IN_SESSION_KEY, user?.id]);

  /**
   * Check if user requires check-in
   */
  const requiresCheckIn = useCallback((): boolean => {
    if (!user) return false;
    if (user.isAdmin || user.role === 'cafe_admin') return false;
    if (!hasSessionCheckIn) return true;

    const hasCafe = Boolean(user.cafe_id);
    const table = String(user.table_number || '').trim().toUpperCase();
    const hasTable = Boolean(table) && table !== 'NULL' && table !== 'UNDEFINED';
    return !(hasCafe && hasTable);
  }, [user, hasSessionCheckIn]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    hasSessionCheckIn,
    login,
    logout,
    updateUser,
    refreshUser,
    setHasSessionCheckIn,
    requiresCheckIn,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * AuthContext kullanım hook'u
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
