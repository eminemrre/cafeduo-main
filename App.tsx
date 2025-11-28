import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Games } from './components/Games';
import { HowItWorks } from './components/HowItWorks';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { CafeDashboard } from './components/CafeDashboard';
import { User } from './types';
import { api } from './lib/api';

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

const App: React.FC = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Check for saved session (mock)
  useEffect(() => {
    const savedUser = localStorage.getItem('cafe_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log("Restoring session for:", user.username);
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
      alert("🎉 TEBRİKLER! Günlük giriş ödülü olarak 10 PUAN kazandınız!");
    }

    if (user.isAdmin) {
      console.log("Redirecting to /admin");
      navigate('/admin');
    } else if (user.role === 'cafe_admin') {
      console.log("Redirecting to /cafe-admin");
      navigate('/cafe-admin');
    } else {
      console.log("Redirecting to /dashboard");
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('cafe_user');
    navigate('/');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      // Optimistic UI update
      setCurrentUser(updatedUser);
      localStorage.setItem('cafe_user', JSON.stringify(updatedUser)); // Update local storage
      // API call
      const serverUser = await api.users.update(updatedUser);
      setCurrentUser(serverUser);
      localStorage.setItem('cafe_user', JSON.stringify(serverUser));
    } catch (error) {
      console.error("Failed to update user", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f141a] text-white font-sans selection:bg-purple-500 selection:text-white">
      {/* Show Navbar on all pages except maybe specific ones if needed. 
          For now, we keep it everywhere. */}
      <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <main>
        <Routes>
          {/* Public Home Route */}
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

          {/* User Dashboard Route */}
          <Route path="/dashboard" element={
            <ProtectedRoute user={currentUser}>
              <Dashboard currentUser={currentUser!} onUpdateUser={handleUpdateUser} />
            </ProtectedRoute>
          } />

          {/* Admin Dashboard Route */}
          <Route path="/admin" element={
            <ProtectedRoute user={currentUser} isAdminRoute={true}>
              <AdminDashboard currentUser={currentUser!} />
            </ProtectedRoute>
          } />

          {/* Cafe Admin Route */}
          <Route path="/cafe-admin" element={
            <ProtectedRoute user={currentUser} requiredRole="cafe_admin">
              <CafeDashboard currentUser={currentUser!} />
            </ProtectedRoute>
          } />

          {/* Catch all - Redirect to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default App;