/**
 * API Layer - REST API Client
 * Handles all HTTP communication with the backend
 */
import type { User, GameRequest, Reward, Cafe, Achievement, GameHistoryEntry, AdminGameRow } from '../types';

const withProtocol = (url: string): string => {
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
  return `${isLocal ? 'http' : 'https'}://${url}`;
};

const enforceBrowserHttps = (url: string): string => {
  if (typeof window === 'undefined') return url;
  if (window.location.protocol !== 'https:') return url;
  if (!url.startsWith('http://')) return url;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) return url;
  return url.replace(/^http:\/\//i, 'https://');
};

export const normalizeApiBaseUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return enforceBrowserHttps(withProtocol(trimmed)).replace(/\/+$/, '').replace(/\/api$/, '');
};

const resolveApiBaseUrl = (): string => {
  try {
    const viteBaseUrl = new Function('return import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || ""')();
    if (viteBaseUrl) return normalizeApiBaseUrl(String(viteBaseUrl));
  } catch {
    // ignore and continue with fallback
  }
  return '';
};

const API_BASE_URL = resolveApiBaseUrl();
const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : '/api';

const parseApiError = async (response: Response): Promise<string> => {
  const readJson = async (): Promise<any | null> => {
    try {
      if (typeof (response as any).clone === 'function') {
        return await (response as any).clone().json();
      }
      if (typeof (response as any).json === 'function') {
        return await (response as any).json();
      }
    } catch {
      // fall through
    }
    return null;
  };

  const readText = async (): Promise<string> => {
    try {
      if (typeof (response as any).clone === 'function') {
        return String(await (response as any).clone().text()).trim();
      }
      if (typeof (response as any).text === 'function') {
        return String(await (response as any).text()).trim();
      }
    } catch {
      // fall through
    }
    return '';
  };

  const retryAfterRaw = response.headers?.get?.('retry-after');
  const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : Number.NaN;

  const withRetryHint = (message: string): string => {
    if (response.status === 429 && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return `${message} ${Math.ceil(retryAfterSeconds)} sn sonra tekrar deneyin.`;
    }
    return message;
  };

  const jsonPayload = await readJson();
  if (jsonPayload) {
    const jsonMessage =
      (typeof jsonPayload === 'string' && jsonPayload) ||
      jsonPayload?.error ||
      jsonPayload?.message ||
      jsonPayload?.detail;
    if (jsonMessage) {
      return withRetryHint(String(jsonMessage));
    }
  }

  const textPayload = await readText();
  if (textPayload) {
    return withRetryHint(textPayload);
  }

  return withRetryHint(`HTTP ${response.status}`);
};

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

  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'İstek zaman aşımına uğradı. Lütfen bağlantınızı kontrol edip tekrar deneyin.'
        : 'Sunucuya bağlanılamadı. Ağ bağlantınızı ve API adresini kontrol edin.';
    throw new Error(message);
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
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
      try {
        return await fetchAPI(`/users/${encodeURIComponent(username)}/active-game`);
      } catch {
        return null;
      }
    },

    getGameHistory: async (username: string): Promise<GameHistoryEntry[]> => {
      try {
        const payload = await fetchAPI(`/users/${encodeURIComponent(username)}/game-history`);
        return Array.isArray(payload) ? payload : [];
      } catch {
        return [];
      }
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

    submitScore: async (
      gameId: number | string,
      payload: { username: string; score: number; roundsWon?: number; durationMs?: number }
    ) => {
      return await fetchAPI(`/games/${gameId}/move`, {
        method: 'POST',
        body: JSON.stringify({
          scoreSubmission: payload,
        }),
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
    buy: async (rewardId: string | number): Promise<{ success: boolean; newPoints: number; reward?: any; error?: string }> => {
      return await fetchAPI('/shop/buy', {
        method: 'POST',
        body: JSON.stringify({ rewardId }),
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

  // ACHIEVEMENTS
  achievements: {
    list: async (userId: string | number): Promise<Achievement[]> => {
      const payload = await fetchAPI(`/achievements/${userId}`);
      if (!Array.isArray(payload)) {
        return [];
      }

      return payload.map((row) => ({
        id: row?.id,
        title: String(row?.title || ''),
        description: String(row?.description || ''),
        icon: String(row?.icon || 'star'),
        points_reward: Math.max(0, Number(row?.points_reward || 0)),
        unlocked: Boolean(row?.unlocked),
        unlockedAt: row?.unlockedAt ? String(row.unlockedAt) : null,
      }));
    },
  },

  // ADMIN (for AdminDashboard)
  admin: {
    getUsers: async (): Promise<User[]> => {
      return await fetchAPI('/admin/users');
    },

    createUser: async (data: {
      username: string;
      email: string;
      password: string;
      department?: string;
      role?: 'user' | 'admin' | 'cafe_admin';
      cafe_id?: number | null;
      points?: number;
    }): Promise<User> => {
      return await fetchAPI('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    deleteUser: async (userId: number | string): Promise<void> => {
      await fetchAPI(`/admin/users/${userId}`, {
        method: 'DELETE',
      });
    },

    updateUserPoints: async (userId: number | string, points: number): Promise<User> => {
      return await fetchAPI(`/admin/users/${userId}/points`, {
        method: 'PATCH',
        body: JSON.stringify({ points }),
      });
    },

    getGames: async (): Promise<AdminGameRow[]> => {
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
