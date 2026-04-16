import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { User } from './types';

const mockVerifyToken = jest.fn();
const mockLogout = jest.fn();
const mockUserUpdate = jest.fn();
const mockSocketConnect = jest.fn();
const mockSocketDisconnect = jest.fn();

let nextAuthUser: User | null = null;

jest.mock('./lib/api', () => ({
  api: {
    auth: {
      verifyToken: (...args: any[]) => mockVerifyToken(...args),
      logout: (...args: any[]) => mockLogout(...args),
    },
    users: {
      update: (...args: any[]) => mockUserUpdate(...args),
    },
  },
}));

jest.mock('./lib/socket', () => ({
  socketService: {
    connect: (...args: any[]) => mockSocketConnect(...args),
    disconnect: (...args: any[]) => mockSocketDisconnect(...args),
  },
}));

jest.mock('./components/Navbar', () => ({
  Navbar: ({ isLoggedIn, onLogout }: { isLoggedIn?: boolean; onLogout?: () => void }) => (
    <div data-testid="navbar">
      <span data-testid="session-state">{isLoggedIn ? 'AUTH' : 'GUEST'}</span>
      <button data-testid="logout-action" onClick={onLogout}>
        logout
      </button>
    </div>
  ),
}));

jest.mock('./components/Hero', () => ({
  Hero: ({ onLogin }: { onLogin: () => void }) => (
    <div data-testid="hero-view">
      <button data-testid="hero-open-login" onClick={onLogin}>
        open-login
      </button>
    </div>
  ),
}));

jest.mock('./components/Games', () => ({
  Games: () => <div data-testid="games-view">games</div>,
}));

jest.mock('./components/HowItWorks', () => ({
  HowItWorks: () => <div data-testid="how-view">how</div>,
}));

jest.mock('./components/About', () => ({
  About: () => <div data-testid="about-view">about</div>,
}));

jest.mock('./components/Footer', () => ({
  Footer: () => <div data-testid="footer-view">footer</div>,
}));

jest.mock('./components/CookieConsent', () => ({
  CookieConsent: () => <div data-testid="cookie-view">cookie</div>,
}));

jest.mock('./components/PrivacyPolicy', () => ({
  PrivacyPolicy: () => <div data-testid="privacy-view">privacy</div>,
}));

jest.mock('./components/AuthModal', () => ({
  AuthModal: ({
    isOpen,
    onLoginSuccess,
  }: {
    isOpen: boolean;
    onLoginSuccess: (user: User) => void;
  }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        <button
          data-testid="auth-login-success"
          onClick={() => {
            if (nextAuthUser) onLoginSuccess(nextAuthUser);
          }}
        >
          submit-auth
        </button>
      </div>
    ) : null,
}));

jest.mock('./components/CafeSelection', () => ({
  CafeSelection: ({
    onCheckInSuccess,
  }: {
    onCheckInSuccess: (cafeName: string, tableNumber: string, cafeId: number) => void;
  }) => (
    <div data-testid="cafe-selection-view">
      <button
        data-testid="mock-check-in"
        onClick={() => onCheckInSuccess('Merkez Kafe', 'MASA05', 1)}
      >
        check-in
      </button>
    </div>
  ),
}));

jest.mock('./components/Dashboard', () => ({
  Dashboard: ({ currentUser }: { currentUser: User }) => (
    <div data-testid="dashboard-view">{currentUser.username}</div>
  ),
}));

jest.mock('./components/AdminDashboard', () => ({
  AdminDashboard: ({ currentUser }: { currentUser: User }) => (
    <div data-testid="admin-view">{currentUser.username}</div>
  ),
}));

jest.mock('./components/CafeDashboard', () => ({
  CafeDashboard: ({ currentUser }: { currentUser: User }) => (
    <div data-testid="cafe-admin-view">{currentUser.username}</div>
  ),
}));

const baseUser: User = {
  id: 7,
  username: 'emin',
  email: 'emin3619@gmail.com',
  points: 120,
  wins: 2,
  gamesPlayed: 5,
  role: 'user',
  isAdmin: false,
};

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
};

const loginFromHero = async (user: User) => {
  nextAuthUser = user;
  fireEvent.click(await screen.findByTestId('hero-open-login'));
  fireEvent.click(await screen.findByTestId('auth-login-success'));
};

describe('App critical session and routing integration', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    nextAuthUser = null;
    sessionStorage.clear();

    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return null;
    });
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it('restores authenticated session from token verification path', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'token') return 'valid-token';
      return null;
    });
    mockVerifyToken.mockResolvedValue({ ...baseUser });

    renderAt('/');

    await waitFor(() => {
      expect(mockVerifyToken).toHaveBeenCalled();
      expect(screen.getByTestId('session-state')).toHaveTextContent('AUTH');
    });
  });

  it('forces check-in even when user has old cafe/table information', async () => {
    renderAt('/');
    await loginFromHero({
      ...baseUser,
      cafe_id: 4,
      table_number: 'MASA12',
    });

    expect(await screen.findByTestId('cafe-selection-view')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();
  });

  it('ignores stale session marker and still requires fresh check-in', async () => {
    sessionStorage.setItem('cafeduo_checked_in_token', 'stale-token');
    renderAt('/');

    await loginFromHero({
      ...baseUser,
      cafe_id: 2,
      table_number: 'MASA03',
    });

    expect(await screen.findByTestId('cafe-selection-view')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();
  });

  it('transitions to dashboard after successful check-in callback', async () => {
    renderAt('/');

    await loginFromHero({
      ...baseUser,
      cafe_id: undefined,
      table_number: undefined,
    });

    const checkInButton = await screen.findByTestId('mock-check-in');
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    });
  });

  it('returns user to landing view on logout', async () => {
    renderAt('/');

    await loginFromHero({
      ...baseUser,
      cafe_id: undefined,
      table_number: undefined,
    });
    mockLogout.mockResolvedValue({});

    fireEvent.click(await screen.findByTestId('mock-check-in'));
    expect(await screen.findByTestId('dashboard-view')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('logout-action'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('hero-view')).toBeInTheDocument();
    });
  });

  it('routes authenticated admin and cafe_admin users to their protected panels', async () => {
    renderAt('/');

    await loginFromHero({
      ...baseUser,
      id: 8,
      role: 'admin',
      isAdmin: true,
    });

    expect(await screen.findByTestId('admin-view')).toHaveTextContent('emin');

    cleanup();
    renderAt('/');
    await loginFromHero({
      ...baseUser,
      id: 9,
      role: 'cafe_admin',
      isAdmin: false,
    });

    expect(await screen.findByTestId('cafe-admin-view')).toHaveTextContent('emin');
  });
});
