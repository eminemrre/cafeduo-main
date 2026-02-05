/**
 * API Layer - REST API Client
 * Handles all HTTP communication with the backend
 */
import type { User, GameRequest, Reward, Cafe } from '../types';

const API_URL = '/api';

/**
 * Generic API fetch wrapper with authentication
 * @param endpoint - API endpoint (e.g., '/auth/login')
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws Error with message from server or network error
 */
async function fetchAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // AUTH
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const data = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      return data.user || data;
    },

    register: async (username: string, email: string, password: string): Promise<User> => {
      const data = await fetchAPI('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      // Auto-login after registration
      if (data.id) {
        const loginData = await api.auth.login(email, password);
        return loginData;
      }
      return data;
    },

    googleLogin: async (): Promise<User> => {
      // Google OAuth flow - redirect to backend
      window.location.href = `${API_URL}/auth/google`;
      throw new Error('Redirecting to Google');
    },

    logout: async (): Promise<void> => {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
    },

    verifyToken: async (): Promise<User | null> => {
      const token = localStorage.getItem('token');
      if (!token) return null;

      try {
        const user = await fetchAPI('/auth/me');
        return user;
      } catch {
        localStorage.removeItem('token');
        return null;
      }
    }
  },

  // USERS
  users: {
    get: async (userId: string): Promise<User | null> => {
      try {
        return await fetchAPI(`/users/${userId}`);
      } catch {
        return null;
      }
    },

    update: async (userData: Partial<User> & { id: string | number }): Promise<User> => {
      return await fetchAPI(`/users/${userData.id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });
    },

    getActiveGame: async (username: string): Promise<GameRequest | null> => {
      const games = await api.games.list();
      const activeGame = games.find((g: any) =>
        (g.hostName === username || g.guestName === username) &&
        (g.status === 'waiting' || g.status === 'playing' || g.status === 'active')
      );
      return activeGame || null;
    }
  },

  // CAFES
  cafes: {
    list: async (): Promise<Cafe[]> => {
      return await fetchAPI('/cafes');
    },

    get: async (cafeId: string): Promise<Cafe | null> => {
      try {
        return await fetchAPI(`/cafes/${cafeId}`);
      } catch {
        return null;
      }
    },

    checkIn: async (params: { cafeId: string | number; tableNumber: number; pin: string }) => {
      // NOTE: userId artık token'dan alınıyor, body'e gönderilmiyor
      return await fetchAPI(`/cafes/${params.cafeId}/check-in`, {
        method: 'POST',
        body: JSON.stringify({
          cafeId: params.cafeId,
          tableNumber: params.tableNumber,
          pin: params.pin,
        }),
      });
    },

    updatePin: async (cafeId: string | number, pin: string, userId?: string | number) => {
      return await fetchAPI(`/cafes/${cafeId}/pin`, {
        method: 'PUT',
        body: JSON.stringify({ pin, userId }),
      });
    }
  },

  // GAMES
  games: {
    list: async (): Promise<GameRequest[]> => {
      return await fetchAPI('/games');
    },

    get: async (gameId: number | string): Promise<GameRequest> => {
      return await fetchAPI(`/games/${gameId}`);
    },

    create: async (data: Partial<GameRequest>): Promise<GameRequest> => {
      return await fetchAPI('/games', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    join: async (gameId: number | string, guestName: string): Promise<GameRequest> => {
      return await fetchAPI(`/games/${gameId}/join`, {
        method: 'POST',
        body: JSON.stringify({ guestName }),
      });
    },

    move: async (gameId: number | string, data: { gameState: any }) => {
      return await fetchAPI(`/games/${gameId}/move`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    finish: async (gameId: number | string, winner: string) => {
      return await fetchAPI(`/games/${gameId}/finish`, {
        method: 'POST',
        body: JSON.stringify({ winner }),
      });
    },

    delete: async (gameId: number | string) => {
      return await fetchAPI(`/games/${gameId}`, {
        method: 'DELETE',
      });
    },

    // REALTIME LISTENERS (Polling-based fallback)
    onGameChange: (gameId: string, callback: (game: any) => void) => {
      let interval: NodeJS.Timeout;

      const poll = async () => {
        try {
          const game = await api.games.get(gameId);
          callback(game);
        } catch (error) {
          console.error('Game polling error:', error);
        }
      };

      poll(); // Initial fetch
      interval = setInterval(poll, 2000); // Poll every 2 seconds

      return () => clearInterval(interval); // Unsubscribe function
    },

    onLobbyChange: (callback: (games: any[]) => void) => {
      let interval: NodeJS.Timeout;

      const poll = async () => {
        try {
          const games = await api.games.list();
          callback(games);
        } catch (error) {
          console.error('Lobby polling error:', error);
        }
      };

      poll(); // Initial fetch
      interval = setInterval(poll, 3000); // Poll every 3 seconds

      return () => clearInterval(interval); // Unsubscribe function
    }
  },

  // REWARDS / SHOP
  rewards: {
    list: async (cafeId?: string | number): Promise<Reward[]> => {
      const url = cafeId ? `/rewards?cafeId=${cafeId}` : '/rewards';
      return await fetchAPI(url);
    },

    create: async (data: Partial<Reward> & { cafeId?: string | number }): Promise<Reward> => {
      return await fetchAPI('/rewards', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    delete: async (rewardId: string | number): Promise<void> => {
      await fetchAPI(`/rewards/${rewardId}`, {
        method: 'DELETE',
      });
    }
  },

  shop: {
    buy: async (userId: string | number, rewardId: string | number): Promise<{ success: boolean; newPoints: number; reward?: any; error?: string }> => {
      return await fetchAPI('/shop/buy', {
        method: 'POST',
        body: JSON.stringify({ userId, rewardId }),
      });
    },

    inventory: async (userId: string | number): Promise<any[]> => {
      return await fetchAPI(`/shop/inventory/${userId}`);
    }
  },

  // LEADERBOARD
  leaderboard: {
    get: async (): Promise<User[]> => {
      return await fetchAPI('/leaderboard');
    }
  },

  // ADMIN (for AdminDashboard)
  admin: {
    getUsers: async (): Promise<User[]> => {
      return await fetchAPI('/admin/users');
    },

    getGames: async (): Promise<GameRequest[]> => {
      return await fetchAPI('/admin/games');
    },

    updateUserRole: async (userId: number | string, role: string, cafeId?: number | null): Promise<void> => {
      await fetchAPI(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role, cafe_id: cafeId }),
      });
    },

    updateCafe: async (cafeId: string | number, data: Partial<Cafe>): Promise<void> => {
      await fetchAPI(`/admin/cafes/${cafeId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    createCafe: async (data: Partial<Cafe>): Promise<Cafe> => {
      return await fetchAPI('/admin/cafes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  },



  // COUPONS (for CafeDashboard)
  coupons: {
    use: async (code: string): Promise<{ success: boolean; item?: any }> => {
      return await fetchAPI('/coupons/use', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    }
  }
};