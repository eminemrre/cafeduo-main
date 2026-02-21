import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';

import { User } from './types';
import { api } from './lib/api';
import { socketService } from './lib/socket';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { CafeSelection } from './components/CafeSelection';
import { CookieConsent } from './components/CookieConsent';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { CustomCursor } from './components/CustomCursor';

// Lazy Load Components
const Games = lazyWithRetry(
  () => import('./components/Games').then((module) => ({ default: module.Games })),
  'Games'
);
const Dashboard = lazyWithRetry(
  () => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })),
  'Dashboard'
);
const AdminDashboard = lazyWithRetry(
  () => import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })),
  'AdminDashboard'
);
const CafeDashboard = lazyWithRetry(
  () => import('./components/CafeDashboard').then((module) => ({ default: module.CafeDashboard })),
  'CafeDashboard'
);
const ResetPasswordPage = lazyWithRetry(
  () => import('./components/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })),
  'ResetPasswordPage'
);

// Loading Component
const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-[var(--rf-ink)]">
    <div className="w-14 h-14 border-4 border-cyan-300 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Protected Route Component Props
interface ProtectedRouteProps {
  children: React.ReactElement;
  user: User | null;
  authReady: boolean;
  isAdminRoute?: boolean;
  requiredRole?: string;
}

// Protected Route Component
const ProtectedRoute = ({
  children,
  user,
  authReady,
  isAdminRoute = false,
  requiredRole,
}: ProtectedRouteProps) => {
  if (!authReady) {
    return <PageLoader />;
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (isAdminRoute && !user.isAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const App: React.FC = () => {
  // Auth modal state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // User session state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authHydrating, setAuthHydrating] = useState(true);
  const [hasSessionCheckIn, setHasSessionCheckIn] = useState(false);

  // Toast hook
  const toast = useToast();

  const navigate = useNavigate();
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);

  // Socket IO Connection
  useEffect(() => {
    socketService.connect();
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Restore user session on load
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      const cachedUserRaw = localStorage.getItem('cafe_user');
      const hasStoredCheckIn = () =>
        typeof window !== 'undefined' &&
        Boolean(token) &&
        sessionStorage.getItem('cafeduo_checked_in_token') === token;
      const syncSessionState = (user: User | null) => {
        if (!isMounted) return;
        setCurrentUser(user);
        setIsLoggedIn(Boolean(user));
        if (!user) {
          setHasSessionCheckIn(false);
          return;
        }
        if (user.isAdmin || user.role === 'cafe_admin') {
          setHasSessionCheckIn(true);
          return;
        }
        const table = String(user.table_number || '').trim().toUpperCase();
        const hasTable = Boolean(table) && table !== 'NULL' && table !== 'UNDEFINED';
        setHasSessionCheckIn(hasStoredCheckIn() && Boolean(user.cafe_id) && hasTable);
      };

      if (!token) {
        localStorage.removeItem('cafe_user');
        syncSessionState(null);
        if (isMounted) setAuthHydrating(false);
        return;
      }

      // Cache-first hydrate for snappy UI, then strict token verification.
      if (cachedUserRaw) {
        try {
          const cachedUser = JSON.parse(cachedUserRaw) as User;
          if (cachedUser?.id) {
            syncSessionState(cachedUser);
          } else {
            localStorage.removeItem('cafe_user');
          }
        } catch (parseErr) {
          console.warn('Cached user parse failed, clearing stale cache.', parseErr);
          localStorage.removeItem('cafe_user');
        }
      }

      try {
        const verifiedUser = await api.auth.verifyToken();
        if (verifiedUser?.id) {
          console.log('Token verified, restoring session for:', verifiedUser.username);
          syncSessionState(verifiedUser);
          localStorage.setItem('cafe_user', JSON.stringify(verifiedUser));
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('cafe_user');
          syncSessionState(null);
        }
      } catch (e) {
        console.error('Token verification failed', e);
        localStorage.removeItem('token');
        localStorage.removeItem('cafe_user');
        syncSessionState(null);
      } finally {
        if (isMounted) setAuthHydrating(false);
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const openLogin = () => {
    setAuthMode('login');
    setIsAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode('register');
    setIsAuthOpen(true);
  };

  useEffect(() => {
    const authQuery = new URLSearchParams(location.search).get('auth');
    if (authQuery === 'login' || authQuery === 'register') {
      setAuthMode(authQuery);
      setIsAuthOpen(true);
    }
  }, [location.search]);

  const handleLoginSuccess = (user: User) => {
    console.log("Login success:", user);

    if (!user || !user.username) {
      console.error("Invalid user data received:", user);
      alert("Giriş başarısız: Geçersiz kullanıcı verisi.");
      return;
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    setHasSessionCheckIn(user.isAdmin || user.role === 'cafe_admin');
    setIsAuthOpen(false);
    localStorage.setItem('cafe_user', JSON.stringify(user));

    // Check for Daily Bonus
    if (user.bonusReceived) {
      toast.success("🎉 Günlük giriş ödülü: 10 PUAN!");
    } else {
      toast.success(`Hoş geldin, ${user.username}!`);
    }

    if (user.isAdmin) {
      navigate('/admin');
    } else if (user.role === 'cafe_admin') {
      navigate('/cafe-admin');
    } else {
      // Regular user logic handled in render (CafeSelection vs Dashboard)
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      toast.success('Çıkış yapıldı. Görüşmek üzere!');
    } catch (err) {
      console.error('Logout error:', err);
    }
    setIsLoggedIn(false);
    setCurrentUser(null);
    setHasSessionCheckIn(false);
    sessionStorage.removeItem('cafeduo_checked_in_token');
    localStorage.removeItem('cafe_user');
    navigate('/');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      setCurrentUser(updatedUser);
      localStorage.setItem('cafe_user', JSON.stringify(updatedUser));
      const serverUser = await api.users.update(updatedUser);
      setCurrentUser(serverUser);
      localStorage.setItem('cafe_user', JSON.stringify(serverUser));
    } catch (error) {
      console.error("Failed to update user", error);
    }
  };

  const handleRefreshUser = async () => {
    try {
      const verifiedUser = await api.auth.verifyToken();
      if (!verifiedUser) return;
      setCurrentUser(verifiedUser);
      localStorage.setItem('cafe_user', JSON.stringify(verifiedUser));
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  };

  const handleCheckInSuccess = (cafeName: string, tableNumber: string, cafeId: string | number) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, cafe_name: cafeName, table_number: tableNumber, cafe_id: cafeId }; // Optimistic update
      // Ideally we should fetch the full updated user from backend, but this is enough for UI
      setCurrentUser(updatedUser);
      setHasSessionCheckIn(true);
      localStorage.setItem('cafe_user', JSON.stringify(updatedUser));
      const token = localStorage.getItem('token');
      if (token) {
        sessionStorage.setItem('cafeduo_checked_in_token', token);
      }
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentPath = location.pathname;

    if (
      previousPath === '/dashboard' &&
      currentPath !== '/dashboard' &&
      currentUser &&
      !currentUser.isAdmin &&
      currentUser.role !== 'cafe_admin'
    ) {
      setHasSessionCheckIn(false);
      sessionStorage.removeItem('cafeduo_checked_in_token');
    }

    previousPathRef.current = currentPath;
  }, [location.pathname, currentUser]);

  const requiresCheckIn = (user: User | null): boolean => {
    if (!user) return false;
    if (user.isAdmin || user.role === 'cafe_admin') return false;
    if (!hasSessionCheckIn) return true;

    const hasCafe = Boolean(user.cafe_id);
    const table = String(user.table_number || '').trim().toUpperCase();
    const hasTable = Boolean(table) && table !== 'NULL' && table !== 'UNDEFINED';
    return !(hasCafe && hasTable);
  };

  return (
    <div className="rf-app-shell min-h-screen text-[var(--rf-ink)] font-sans selection:bg-cyan-300/30 selection:text-white">
      <CustomCursor />
      <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={
              <>
                <Hero
                  onLogin={openLogin}
                  onRegister={openRegister}
                  isLoggedIn={isLoggedIn}
                  userRole={currentUser?.role}
                  isAdmin={currentUser?.isAdmin}
                />
                <HowItWorks />
                <Games />
                <About />
              </>
            } />

            <Route path="/dashboard" element={
              <ProtectedRoute user={currentUser} authReady={!authHydrating}>
                <ErrorBoundary>
                  {requiresCheckIn(currentUser) ? (
                    <CafeSelection currentUser={currentUser!} onCheckInSuccess={handleCheckInSuccess} />
                  ) : (
                    <Dashboard
                      currentUser={currentUser!}
                      onUpdateUser={handleUpdateUser}
                      onRefreshUser={handleRefreshUser}
                    />
                  )}
                </ErrorBoundary>
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute user={currentUser} authReady={!authHydrating} isAdminRoute={true}>
                <ErrorBoundary>
                  <AdminDashboard currentUser={currentUser!} />
                </ErrorBoundary>
              </ProtectedRoute>
            } />

            <Route path="/cafe-admin" element={
              <ProtectedRoute user={currentUser} authReady={!authHydrating} requiredRole="cafe_admin">
                <ErrorBoundary>
                  <CafeDashboard currentUser={currentUser!} />
                </ErrorBoundary>
              </ProtectedRoute>
            } />

            {/* KVKK Gizlilik Politikası */}
            <Route path="/gizlilik" element={<PrivacyPolicy />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onLoginSuccess={handleLoginSuccess}
      />
      <CookieConsent />
    </div>
  );
};

// AuthProvider + ToastProvider ile sarmalanmış App
const AppWithProviders: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </AuthProvider>
);

export default AppWithProviders;
