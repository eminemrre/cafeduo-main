import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { LandingExperience } from './components/LandingExperience';
import { HowItWorks } from './components/HowItWorks';
import { Games } from './components/Games';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';

import { User, UserProfileUpdates } from './types';
import { api } from './lib/api';
import { socketService } from './lib/socket';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { CafeSelection } from './components/CafeSelection';
import { CookieConsent } from './components/CookieConsent';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// Lazy Load Components
const Dashboard = lazyWithRetry(
  () => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })),
  'Dashboard'
);
const AdminDashboard = lazyWithRetry(
  () =>
    import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })),
  'AdminDashboard'
);
const CafeDashboard = lazyWithRetry(
  () => import('./components/CafeDashboard').then((module) => ({ default: module.CafeDashboard })),
  'CafeDashboard'
);
const ResetPasswordPage = lazyWithRetry(
  () =>
    import('./components/ResetPasswordPage').then((module) => ({
      default: module.ResetPasswordPage,
    })),
  'ResetPasswordPage'
);
const BusinessLanding = lazyWithRetry(
  () =>
    import('./components/BusinessLanding').then((module) => ({
      default: module.BusinessLanding,
    })),
  'BusinessLanding'
);
// Loading Component
const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-carbon">
    <div className="w-14 h-14 border-4 border-carbon border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Protected Route Component Props
interface ProtectedRouteProps {
  children: React.ReactElement;
  isAdminRoute?: boolean;
  requiredRole?: string;
}

// Page Transition Wrapper
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduced ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, isAdminRoute = false, requiredRole }: ProtectedRouteProps) => {
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
  const {
    user,
    isLoading: _isLoading,
    login,
    logout,
    updateUser,
    refreshUser,
    setHasSessionCheckIn,
    requiresCheckIn,
  } = useAuth();

  // Toast hook
  const toast = useToast();

  const navigate = useNavigate();
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);

  // Socket IO Connection
  useEffect(() => {
    if (!user) {
      socketService.disconnect();
      return;
    }

    socketService.connect();
    return () => {
      socketService.disconnect();
    };
    // user?.id is the only stable identity field we actually depend on; the
    // user object reference changes on every refresh which would reconnect the
    // socket unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    if (!userData || !userData.username) {
      console.error('Invalid user data received:', userData);
      toast.error('Giriş başarısız: Geçersiz kullanıcı verisi.');
      return;
    }

    // Use AuthContext login
    login(userData);
    setIsAuthOpen(false);

    // Check for Daily Bonus
    if (userData.bonusReceived) {
      toast.success('🎉 Günlük giriş ödülü: 10 PUAN!');
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

  const enterClub = () => {
    if (!user) return openRegister();
    navigate(user.isAdmin ? '/admin' : user.role === 'cafe_admin' ? '/cafe-admin' : '/dashboard');
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Çıkış yapıldı. Görüşmek üzere!');
    navigate('/');
  };

  const handleUpdateProfile = async (updates: UserProfileUpdates) => {
    if (!user) throw new Error('Profil kaydı için oturum gerekli.');
    const serverUser = await api.users.updateProfile(user.id, updates);
    updateUser(serverUser);
  };

  const handleUpdateUser = async (updatedUser: User, options?: { throwOnError?: boolean }) => {
    try {
      // Profile forms wait for confirmation so a rejected edit stays editable.
      if (!options?.throwOnError) updateUser(updatedUser);
      // Server update
      const serverUser = await api.users.update(updatedUser);
      updateUser(serverUser);
    } catch (error) {
      console.error('Failed to update user', error);
      if (options?.throwOnError) throw error;
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
        cafe_id: cafeId,
      };
      updateUser(updatedUser);
      setHasSessionCheckIn(true);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      navigate('/dashboard');
    }
  };

  return (
    <div className="duo-app riso-kantin riso-kantin-app min-h-screen font-riso-body selection:bg-riso-pink selection:text-carbon">
      <Navbar isLoggedIn={!!user} user={user} onLogout={handleLogout} />

      <main>
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <PageTransition>
                    <LandingExperience>
                      <Hero
                        onLogin={openLogin}
                        onRegister={openRegister}
                        isLoggedIn={!!user}
                        userRole={user?.role}
                        isAdmin={user?.isAdmin}
                      />
                      <HowItWorks />
                      <Games onPlayClick={enterClub} />
                      <About onJoin={enterClub} isLoggedIn={!!user} />
                    </LandingExperience>
                  </PageTransition>
                }
              />

              <Route
                path="/kafeler"
                element={
                  <PageTransition>
                    <BusinessLanding />
                  </PageTransition>
                }
              />

              <Route
                path="/dashboard"
                element={
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
                            onUpdateProfile={handleUpdateProfile}
                            onRefreshUser={handleRefreshUser}
                          />
                        )}
                      </ErrorBoundary>
                    </PageTransition>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute isAdminRoute={true}>
                    <PageTransition>
                      <ErrorBoundary>
                        <AdminDashboard currentUser={user!} />
                      </ErrorBoundary>
                    </PageTransition>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/cafe-admin"
                element={
                  <ProtectedRoute requiredRole="cafe_admin">
                    <PageTransition>
                      <ErrorBoundary>
                        <CafeDashboard currentUser={user!} />
                      </ErrorBoundary>
                    </PageTransition>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gizlilik"
                element={
                  <PageTransition>
                    <PrivacyPolicy />
                  </PageTransition>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <PageTransition>
                    <ResetPasswordPage />
                  </PageTransition>
                }
              />
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
