import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { User } from './types';
import { api } from './lib/api';
import { CafeSelection } from './components/CafeSelection';
import { CookieConsent } from './components/CookieConsent';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { FirestoreSeed } from './components/FirestoreSeed';

// Lazy Load Components
const Games = React.lazy(() => import('./components/Games').then(module => ({ default: module.Games })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const CafeDashboard = React.lazy(() => import('./components/CafeDashboard').then(module => ({ default: module.CafeDashboard })));

// Loading Component
const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-white">
    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, user, isAdminRoute = false, requiredRole }: { children: React.ReactElement, user: User | null, isAdminRoute?: boolean, requiredRole?: string }) => {
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

import { Toast, ToastType } from './components/Toast';

// ... (rest of imports)

const App: React.FC = () => {
  // ... (state remains same)
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // ... (useEffect remains same)
  useEffect(() => {
    const savedUser = localStorage.getItem('cafe_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log("Restoring session for:", user.username);

        // Restore user session without resetting location
        // This allows users to refresh the page without being kicked out of the cafe
        setCurrentUser(user);
        setIsLoggedIn(true);
      } catch (e) {
        console.error("Failed to parse saved user", e);
        localStorage.removeItem('cafe_user');
      }
    }
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

    // Check for Daily Bonus
    if ((user as any).bonusReceived) {
      setToast({ message: "🎉 TEBRİKLER! Günlük giriş ödülü olarak 10 PUAN kazandınız!", type: 'success' });
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
    } catch (err) {
      console.error('Logout error:', err);
    }
    setIsLoggedIn(false);
    setCurrentUser(null);
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

  const handleCheckInSuccess = (cafeName: string, tableNumber: string, cafeId: number) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, cafe_name: cafeName, table_number: tableNumber, cafe_id: cafeId }; // Optimistic update
      // Ideally we should fetch the full updated user from backend, but this is enough for UI
      setCurrentUser(updatedUser);
      localStorage.setItem('cafe_user', JSON.stringify(updatedUser));
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f141a] text-white font-sans selection:bg-purple-500 selection:text-white">
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
                {/* CHECK-IN LOGIC: If user has no cafe_id, show CafeSelection */}
                {!currentUser?.isAdmin && currentUser?.role !== 'cafe_admin' && !currentUser?.cafe_id ? (
                  <CafeSelection currentUser={currentUser!} onCheckInSuccess={handleCheckInSuccess} />
                ) : (
                  <Dashboard currentUser={currentUser!} onUpdateUser={handleUpdateUser} />
                )}
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute user={currentUser} isAdminRoute={true}>
                <AdminDashboard currentUser={currentUser!} />
              </ProtectedRoute>
            } />

            <Route path="/cafe-admin" element={
              <ProtectedRoute user={currentUser} requiredRole="cafe_admin">
                <CafeDashboard currentUser={currentUser!} />
              </ProtectedRoute>
            } />

            {/* KVKK Gizlilik Politikası */}
            <Route path="/gizlilik" element={<PrivacyPolicy />} />

            {/* Firestore Seed Page */}
            <Route path="/seed" element={<FirestoreSeed />} />

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

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Debug overlay - only show in development */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-0 right-0 bg-black/80 text-green-400 p-2 text-xs font-mono z-[100] pointer-events-none opacity-50 hover:opacity-100">
          <p>v2.1 - Debug</p>
          <p>User: {currentUser?.username || 'Guest'}</p>
          <p>CafeID: {currentUser?.cafe_id || 'NULL'}</p>
          <p>Table: {currentUser?.table_number || 'NULL'}</p>
          <p>Env: {import.meta.env.MODE}</p>
        </div>
      )}
    </div>
  );
};

export default App;