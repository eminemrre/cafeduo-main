import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from '../types';

const mockVerifyToken = jest.fn();
const mockLogout = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../lib/api', () => ({
  api: {
    auth: {
      verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
      logout: (...args: unknown[]) => mockLogout(...args),
    },
    users: {
      get: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

const baseUser: User = {
  id: 10,
  username: 'emin',
  email: 'emin3619@gmail.com',
  points: 100,
  wins: 2,
  gamesPlayed: 4,
  role: 'user',
};

const AuthConsumer = () => {
  const { user, isLoading, isAuthenticated, login, logout, updateUser, refreshUser } = useAuth();

  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="auth">{String(isAuthenticated)}</p>
      <p data-testid="username">{user?.username ?? 'none'}</p>
      <button onClick={() => login(baseUser, 'token-123')}>login</button>
      <button onClick={() => updateUser({ username: 'updated-emin' })}>update</button>
      <button onClick={() => refreshUser()}>refresh</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);
    mockLogout.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(null);
  });

  it('restores session with a valid token', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'token' ? 'persisted-token' : null
    );
    mockVerifyToken.mockResolvedValue(baseUser);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(mockVerifyToken).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('auth')).toHaveTextContent('true');
    expect(screen.getByTestId('username')).toHaveTextContent('emin');
  });

  it('cleans token and session when token is invalid', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'token' ? 'stale-token' : null
    );
    mockVerifyToken.mockResolvedValue(null);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('cafe_user');
    expect(screen.getByTestId('auth')).toHaveTextContent('false');
  });

  it('persists local session on login and applies local profile updates', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(window.localStorage.setItem).toHaveBeenCalledWith('token', 'token-123');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cafe_user', JSON.stringify(baseUser));
    expect(screen.getByTestId('auth')).toHaveTextContent('true');
    expect(screen.getByTestId('username')).toHaveTextContent('emin');

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    expect(screen.getByTestId('username')).toHaveTextContent('updated-emin');
    expect(window.localStorage.setItem).toHaveBeenLastCalledWith(
      'cafe_user',
      JSON.stringify({ ...baseUser, username: 'updated-emin' })
    );
  });

  it('refreshes user from API and updates persisted session', async () => {
    const refreshedUser: User = { ...baseUser, username: 'emin-refreshed', points: 250 };

    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    mockGetUser.mockResolvedValue(refreshedUser);

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledWith(baseUser.id.toString());
      expect(screen.getByTestId('username')).toHaveTextContent('emin-refreshed');
    });
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'cafe_user',
      JSON.stringify(refreshedUser)
    );
  });

  it('clears session on logout even when API logout fails', async () => {
    mockLogout.mockRejectedValue(new Error('network'));

    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('false');
      expect(screen.getByTestId('username')).toHaveTextContent('none');
    });
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('cafe_user');
  });

  it('throws if useAuth is used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const Broken = () => {
      useAuth();
      return null;
    };

    expect(() => render(<Broken />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });
});
