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
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { CustomCursor } from './components/CustomCursor';
import { TankBattleHarness } from './components/dev/TankBattleHarness';
import { motion, AnimatePresence } from 'framer-motion';

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
const Store = lazyWithRetry(
  () => import('./components/Store').then((module) => ({ default: module.Store })),
  'Store'
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
  isAdminRoute?: boolean;
  requiredRole?: string;
}

// Page Transition Wrapper
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, filter: 'blur(8px)', y: 10 }}
    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
    exit={{ opacity: 0, filter: 'blur(8px)', y: -10 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className="h-full w-full"
  >
    {children}
  </motion.div>
);

// Protected Route Component
const ProtectedRoute = ({
  children,
  isAdminRoute = false,
  requiredRole,
}: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
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

const AppContent: React.FC = () => {
  // Auth modal state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Auth context
  const { user, isLoading, login, logout, updateUser, refreshUser, setHasSessionCheckIn, requiresCheckIn } = useAuth();

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

  // Handle auth query params
  useEffect(() => {
    const authQuery = new URLSearchParams(location.search).get('auth');
    if (authQuery === 'login' || authQuery === 'register') {
      setAuthMode(authQuery);
      setIsAuthOpen(true);
    }
  }, [location.search]);

  // Handle check-in state reset when leaving dashboard
  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentPath = location.pathname;

    if (
      previousPath === '/dashboard' &&
      currentPath !== '/dashboard' &&
      user &&
      !user.isAdmin &&
      user.role !== 'cafe_admin'
    ) {
      setHasSessionCheckIn(false);
    }

    previousPathRef.current = currentPath;
  }, [location.pathname, user, setHasSessionCheckIn]);

  const openLogin = () => {
    setAuthMode('login');
    setIsAuthOpen(true);
  };

  const openRegister = () => {
    setAuthMode('register');
    setIsAuthOpen(true);
  };

  const handleLoginSuccess = async (userData: User) => {
    console.log("Login success:", userData);

    if (!userData || !userData.username) {
      console.error("Invalid user data received:", userData);
      alert("Giriş başarısız: Geçersiz kullanıcı verisi.");
      return;
    }

    // Use AuthContext login
    login(userData);
    setIsAuthOpen(false);

    // Check for Daily Bonus
    if (userData.bonusReceived) {
      toast.success("🎉 Günlük giriş ödülü: 10 PUAN!");
    } else {
      toast.success(`Hoş geldin, ${userData.username}!`);
    }

    // Navigate based on role
    if (userData.isAdmin) {
      navigate('/admin');
    } else if (userData.role === 'cafe_admin') {
      navigate('/cafe-admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Çıkış yapıldı. Görüşmek üzere!');
    navigate('/');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      // Optimistic update
      updateUser(updatedUser);
      // Server update
      const serverUser = await api.users.update(updatedUser);
      updateUser(serverUser);
    } catch (error) {
      console.error("Failed to update user", error);
      toast.error('Kullanıcı güncellenirken hata oluştu');
    }
  };

  const handleRefreshUser = async () => {
    try {
      await refreshUser();
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  };

  const handleCheckInSuccess = (cafeName: string, tableNumber: string, cafeId: string | number) => {
    if (user) {
      const updatedUser = { 
        ...user, 
        cafe_name: cafeName, 
        table_number: tableNumber, 
        cafe_id: cafeId 
      };
      updateUser(updatedUser);
      setHasSessionCheckIn(true);
      navigate('/dashboard');
    }
  };

  return (
    <div className="rf-app-shell min-h-screen text-[var(--rf-ink)] font-sans selection:bg-cyan-300/30 selection:text-white">
      <CustomCursor />
      <Navbar 
        isLoggedIn={!!user} 
        user={user} 
        onLogout={handleLogout} 
      />

      <main>
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={
                <PageTransition>
                  <Hero
                    onLogin={openLogin}
                    onRegister={openRegister}
                    isLoggedIn={!!user}
                    userRole={user?.role}
                    isAdmin={user?.isAdmin}
                  />
                  <HowItWorks />
                  <Games onPlayClick={openRegister} />
                  <About />
                </PageTransition>
              } />

              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <PageTransition>
                    <ErrorBoundary>
                      {requiresCheckIn() ? (
                        <CafeSelection 
                          currentUser={user!} 
                          onCheckInSuccess={handleCheckInSuccess} 
                        />
                      ) : (
                        <Dashboard
                          currentUser={user!}
                          onUpdateUser={handleUpdateUser}
                          onRefreshUser={handleRefreshUser}
                        />
                      )}
                    </ErrorBoundary>
                  </PageTransition>
                </ProtectedRoute>
              } />

              <Route path="/admin" element={
                <ProtectedRoute isAdminRoute={true}>
                  <PageTransition>
                    <ErrorBoundary>
                      <AdminDashboard currentUser={user!} />
                    </ErrorBoundary>
                  </PageTransition>
                </ProtectedRoute>
              } />

              <Route path="/cafe-admin" element={
                <ProtectedRoute requiredRole="cafe_admin">
                  <PageTransition>
                    <ErrorBoundary>
                      <CafeDashboard currentUser={user!} />
                    </ErrorBoundary>
                  </PageTransition>
                </ProtectedRoute>
              } />

              <Route path="/gizlilik" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
              <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
              <Route path="/store" element={<PageTransition><Store user={user} updateUser={updateUser} onShowToast={toast} /></PageTransition>} />
              <Route path="/dev/tank-harness" element={<PageTransition><TankBattleHarness /></PageTransition>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
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
const App: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  </AuthProvider>
);

export default App;
