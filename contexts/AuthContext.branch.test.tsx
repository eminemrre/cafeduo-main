/**
 * Additional branch coverage tests for contexts/AuthContext.tsx
 * Targets uncovered branches: lines 48-64 (cache restore), 77 (admin check), 91-95 (error path), 154 (refreshUser), 167 (setHasSessionCheckIn)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from '../types';
import { suppressExpectedReactError } from '../test-utils/suppressReactError';

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

const adminUser: User = {
  ...baseUser,
  id: 20,
  username: 'admin',
  role: 'admin',
  isAdmin: true,
};

const cafeAdminUser: User = {
  ...baseUser,
  id: 30,
  username: 'cafeadmin',
  role: 'cafe_admin',
};

const checkedInUser: User = {
  ...baseUser,
  cafe_id: 1,
  table_number: 'MASA05',
};

const FullConsumer = () => {
  const {
    user, isLoading, isAuthenticated,
    hasSessionCheckIn, login, logout,
    updateUser, refreshUser,
    setHasSessionCheckIn, requiresCheckIn,
  } = useAuth();

  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="auth">{String(isAuthenticated)}</p>
      <p data-testid="username">{user?.username ?? 'none'}</p>
      <p data-testid="check-in">{String(hasSessionCheckIn)}</p>
      <p data-testid="requires-check-in">{String(requiresCheckIn())}</p>
      <button onClick={() => login(baseUser)}>login-user</button>
      <button onClick={() => login(adminUser)}>login-admin</button>
      <button onClick={() => login(cafeAdminUser)}>login-cafe-admin</button>
      <button onClick={() => login(checkedInUser)}>login-checked-in</button>
      <button onClick={() => updateUser({ username: 'updated' })}>update</button>
      <button onClick={() => refreshUser()}>refresh</button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => setHasSessionCheckIn(true)}>set-check-in-true</button>
      <button onClick={() => setHasSessionCheckIn(false)}>set-check-in-false</button>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <AuthProvider>
      <FullConsumer />
    </AuthProvider>
  );

describe('AuthContext branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
    (window.sessionStorage.getItem as jest.Mock).mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);
    mockLogout.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cache-first hydration', () => {
    it('restores admin user from cache with hasSessionCheckIn=true', async () => {
      const cachedAdmin = { ...adminUser };
      (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(cachedAdmin));
      mockVerifyToken.mockResolvedValue(cachedAdmin);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('auth')).toHaveTextContent('true');
      expect(screen.getByTestId('username')).toHaveTextContent('admin');
    });

    it('restores cafe_admin user from cache with hasSessionCheckIn=true', async () => {
      const cached = { ...cafeAdminUser };
      (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(cached));
      mockVerifyToken.mockResolvedValue(cached);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('auth')).toHaveTextContent('true');
    });

    it('restores checked-in user with matching session storage', async () => {
      const cached = { ...checkedInUser };
      (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(cached));
      (window.sessionStorage.getItem as jest.Mock).mockReturnValue('10');
      mockVerifyToken.mockResolvedValue(cached);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('auth')).toHaveTextContent('true');
      expect(screen.getByTestId('check-in')).toHaveTextContent('true');
    });

    it('does not restore check-in when session user ID mismatches', async () => {
      const cached = { ...checkedInUser };
      (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(cached));
      (window.sessionStorage.getItem as jest.Mock).mockReturnValue('99'); // Different user
      mockVerifyToken.mockResolvedValue(cached);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Should not have check-in because session ID doesn't match
      expect(screen.getByTestId('auth')).toHaveTextContent('true');
    });

    it('handles corrupt cached user JSON gracefully', async () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue('{bad json');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockVerifyToken.mockResolvedValue(null);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Cached user parse failed, clearing stale cache.',
        expect.any(Error)
      );
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('cafe_user');
      consoleSpy.mockRestore();
    });

    it('handles cached user without id gracefully', async () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify({ username: 'no-id' }));
      mockVerifyToken.mockResolvedValue(null);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('auth')).toHaveTextContent('false');
    });

    it('handles user with table_number NULL string', async () => {
      const userWithNullTable = { ...checkedInUser, table_number: 'NULL' };
      (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(userWithNullTable));
      (window.sessionStorage.getItem as jest.Mock).mockReturnValue('10');
      mockVerifyToken.mockResolvedValue(userWithNullTable);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('handles user with undefined table_number', async () => {
      const userNoTable = { ...baseUser, cafe_id: 1, table_number: undefined };
      (window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(userNoTable));
      (window.sessionStorage.getItem as jest.Mock).mockReturnValue('10');
      mockVerifyToken.mockResolvedValue(userNoTable);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('session restore error path', () => {
    it('handles verifyToken throwing an error', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('auth')).toHaveTextContent('false');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('cafe_user');
      expect(window.sessionStorage.removeItem).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('login with different roles', () => {
    it('sets hasSessionCheckIn=true for admin login', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-admin' }));

      expect(screen.getByTestId('check-in')).toHaveTextContent('true');
    });

    it('sets hasSessionCheckIn=true for cafe_admin login', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-cafe-admin' }));

      expect(screen.getByTestId('check-in')).toHaveTextContent('true');
    });

    it('sets hasSessionCheckIn=false for regular user login', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-user' }));

      expect(screen.getByTestId('check-in')).toHaveTextContent('false');
    });
  });

  describe('refreshUser', () => {
    it('does nothing when user is null', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('does nothing when users.get returns null', async () => {
      mockGetUser.mockResolvedValue(null);

      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-user' }));
      fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalled();
      });

      // Username should remain unchanged since get returned null
      expect(screen.getByTestId('username')).toHaveTextContent('emin');
    });

    it('handles refreshUser API error', async () => {
      mockGetUser.mockRejectedValue(new Error('API error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-user' }));
      fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh user:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('updateUser', () => {
    it('returns null when no user is set', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // No user logged in, update should be a no-op
      fireEvent.click(screen.getByRole('button', { name: 'update' }));

      expect(screen.getByTestId('username')).toHaveTextContent('none');
    });
  });

  describe('setHasSessionCheckIn', () => {
    it('stores check-in user id in sessionStorage when set to true', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-user' }));
      fireEvent.click(screen.getByRole('button', { name: 'set-check-in-true' }));

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        'cafeduo_checked_in_user_id',
        '10'
      );
    });

    it('removes check-in from sessionStorage when set to false', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-user' }));
      fireEvent.click(screen.getByRole('button', { name: 'set-check-in-false' }));

      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('cafeduo_checked_in_user_id');
    });

    it('removes check-in when no user is logged in', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'set-check-in-true' }));

      // No user, so sessionStorage.removeItem should be called
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('cafeduo_checked_in_user_id');
    });
  });

  describe('requiresCheckIn', () => {
    it('returns false when no user is set', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('requires-check-in')).toHaveTextContent('false');
    });

    it('returns false for admin users', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-admin' }));

      expect(screen.getByTestId('requires-check-in')).toHaveTextContent('false');
    });

    it('returns false for cafe_admin users', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-cafe-admin' }));

      expect(screen.getByTestId('requires-check-in')).toHaveTextContent('false');
    });

    it('returns true for regular user without check-in', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'login-user' }));

      expect(screen.getByTestId('requires-check-in')).toHaveTextContent('true');
    });
  });
});
