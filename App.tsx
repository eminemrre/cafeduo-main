import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';

import { User } from './types';
import { api } from './lib/api';
import { socketService } from './lib/socket';
import { CafeSelection } from './components/CafeSelection';
import { CookieConsent } from './components/CookieConsent';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';

// Lazy Load Components
const Games = React.lazy(() => import('./components/Games').then(module => ({ default: module.Games })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const CafeDashboard = React.lazy(() => import('./components/CafeDashboard').then(module => ({ default: module.CafeDashboard })));

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
  isAdminRoute?: boolean;
  requiredRole?: string;
}

const CHECKIN_SESSION_KEY = 'cafeduo_checked_in_token';

// Protected Route Component
const ProtectedRoute = ({ children, user, isAdminRoute = false, requiredRole }: ProtectedRouteProps) => {
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
  
  // Toast hook
  const toast = useToast();

  const navigate = useNavigate();

  // Socket IO Connection
  useEffect(() => {
    socketService.connect();
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Restore user session on load
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');

      if (token) {
        try {
          // Verify token with backend
          const user = await api.auth.verifyToken();
          if (user) {
            console.log("Token verified, restoring session for:", user.username);
            setCurrentUser(user);
            setIsLoggedIn(true);
            localStorage.setItem('cafe_user', JSON.stringify(user));
            return;
          }
        } catch (e) {
          console.error("Token verification failed", e);
          localStorage.removeItem('token');
          localStorage.removeItem('cafe_user');
        }
      }
    };

    restoreSession();
  }, []);

  const openLogin = () => {
    setAuthMode('login');
    setIsAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode('register');
    setIsAuthOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    console.log("Login success:", user);

    if (!user || !user.username) {
      console.error("Invalid user data received:", user);
      alert("Giriş başarısız: Geçersiz kullanıcı verisi.");
      return;
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    setIsAuthOpen(false);
      localStorage.setItem('cafe_user', JSON.stringify(user));
      sessionStorage.removeItem(CHECKIN_SESSION_KEY);

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
      localStorage.removeItem('cafe_user');
      sessionStorage.removeItem(CHECKIN_SESSION_KEY);
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

  const handleCheckInSuccess = (cafeName: string, tableNumber: string, cafeId: string | number) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, cafe_name: cafeName, table_number: tableNumber, cafe_id: cafeId }; // Optimistic update
      // Ideally we should fetch the full updated user from backend, but this is enough for UI
      setCurrentUser(updatedUser);
      localStorage.setItem('cafe_user', JSON.stringify(updatedUser));
      const token = localStorage.getItem('token');
      if (token) {
        sessionStorage.setItem(CHECKIN_SESSION_KEY, token);
      } else {
        // Test ve token restore edge-case'lerinde legacy işaretleyici.
        sessionStorage.setItem(CHECKIN_SESSION_KEY, String(currentUser.id));
      }
      navigate('/dashboard');
    }
  };

  const requiresCheckIn = (user: User | null): boolean => {
    if (!user) return false;
    if (user.isAdmin || user.role === 'cafe_admin') return false;

    const hasCafe = Boolean(user.cafe_id);
    const table = String(user.table_number || '').trim().toUpperCase();
    const hasTable = Boolean(table) && table !== 'NULL' && table !== 'UNDEFINED';
    const token = localStorage.getItem('token');
    const marker = sessionStorage.getItem(CHECKIN_SESSION_KEY);
    const hasSessionCheckIn = token ? marker === token : marker === String(user.id);

    return !(hasCafe && hasTable && hasSessionCheckIn);
  };

  return (
    <div className="rf-app-shell min-h-screen text-[var(--rf-ink)] font-sans selection:bg-cyan-300/30 selection:text-white">
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
                <Games />
                <HowItWorks />
                <About />
              </>
            } />

            <Route path="/dashboard" element={
              <ProtectedRoute user={currentUser}>
                <ErrorBoundary>
                  {requiresCheckIn(currentUser) ? (
                    <CafeSelection currentUser={currentUser!} onCheckInSuccess={handleCheckInSuccess} />
                  ) : (
                    <Dashboard currentUser={currentUser!} onUpdateUser={handleUpdateUser} />
                  )}
                </ErrorBoundary>
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute user={currentUser} isAdminRoute={true}>
                <ErrorBoundary>
                  <AdminDashboard currentUser={currentUser!} />
                </ErrorBoundary>
              </ProtectedRoute>
            } />

            <Route path="/cafe-admin" element={
              <ProtectedRoute user={currentUser} requiredRole="cafe_admin">
                <ErrorBoundary>
                  <CafeDashboard currentUser={currentUser!} />
                </ErrorBoundary>
              </ProtectedRoute>
            } />

            {/* KVKK Gizlilik Politikası */}
            <Route path="/gizlilik" element={<PrivacyPolicy />} />

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
