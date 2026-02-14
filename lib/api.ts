/**
 * API Layer - REST API Client
 * Handles all HTTP communication with the backend
 */
import type {
  User,
  GameRequest,
  Reward,
  Cafe,
  Achievement,
  GameHistoryEntry,
  AdminGameRow,
  BuildMeta,
  DeleteCafeResult,
} from '../types';

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

interface ShopRewardPayload {
  id: number;
  user_id: number;
  item_id: number;
  item_title: string;
  code: string;
  redeemed_at: string;
  is_used: boolean;
  used_at: string | null;
}

interface ShopBuyResponse {
  success: boolean;
  newPoints: number;
  reward?: ShopRewardPayload;
  error?: string;
}

interface ShopInventoryRow {
  redeemId: string | number;
  id: string | number;
  title: string;
  code: string;
  redeemedAt: string;
  isUsed: boolean;
}

interface CouponUseItem {
  id?: number;
  user_id?: number;
  item_id?: number;
  item_title?: string;
  code: string;
  redeemed_at?: string;
  is_used?: boolean;
  used_at?: string | null;
}

interface AuthLoginResponse {
  token?: string;
  user?: User;
  id?: string | number;
}

interface AuthRegisterResponse {
  id?: string | number;
  username?: string;
  email?: string;
}

interface CafeCheckInResponse {
  cafeName?: string;
  cafe?: {
    name?: string;
  };
  table?: string;
}

interface ApiErrorResponse {
  status: number;
  headers?: {
    get?: (name: string) => string | null;
  };
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  clone?: () => ApiErrorResponse;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseApiError = async (response: ApiErrorResponse): Promise<string> => {
  const readJson = async (): Promise<unknown | null> => {
    try {
      const source = typeof response.clone === 'function' ? response.clone() : response;
      if (typeof source.json === 'function') {
        return await source.json();
      }
    } catch {
      // fall through
    }
    return null;
  };

  const readText = async (): Promise<string> => {
    try {
      const source = typeof response.clone === 'function' ? response.clone() : response;
      if (typeof source.text === 'function') {
        return String(await source.text()).trim();
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
      (isRecord(jsonPayload) && (jsonPayload.error || jsonPayload.message || jsonPayload.detail));
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
async function fetchAPI<TResponse = unknown>(endpoint: string, options: RequestInit = {}): Promise<TResponse> {
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

  return (await response.json()) as TResponse;
}

export const api = {
  meta: {
    getVersion: async (): Promise<BuildMeta & { nodeEnv?: string }> => {
      const data = await fetchAPI<{ commit?: string; buildTime?: string | null; nodeEnv?: string }>('/meta/version');
      const rawVersion = String(data.commit || 'local').trim();
      const shortVersion = /^[a-f0-9]{8,}$/i.test(rawVersion)
        ? rawVersion.slice(0, 7)
        : rawVersion.slice(0, 12);
      return {
        version: rawVersion || 'local',
        shortVersion: shortVersion || 'local',
        buildTime: String(data.buildTime || 'unknown'),
        nodeEnv: data.nodeEnv,
      };
    },
  },

  // AUTH
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const data = await fetchAPI<AuthLoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      return (data.user || data) as User;
    },

    register: async (username: string, email: string, password: string): Promise<User> => {
      const data = await fetchAPI<AuthRegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      // Auto-login after registration
      if (data.id) {
        const loginData = await api.auth.login(email, password);
        return loginData;
      }
      return data as User;
    },

    googleLogin: async (token: string): Promise<User> => {
      const data = await fetchAPI<AuthLoginResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      return (data.user || data) as User;
    },

    forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
      return await fetchAPI('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    resetPassword: async (token: string, password: string): Promise<{ success: boolean; message: string }> => {
      return await fetchAPI('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
    },

    logout: async (): Promise<void> => {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('cafe_user');
    },

    verifyToken: async (): Promise<User | null> => {
      const token = localStorage.getItem('token');
      if (!token) return null;

      try {
        const user = await fetchAPI<User>('/auth/me');
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

    checkIn: async (params: {
      cafeId: string | number;
      tableNumber: number;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      tableVerificationCode?: string;
    }) => {
      // NOTE: userId artık token'dan alınıyor, body'e gönderilmiyor
      const payload: {
        cafeId: string | number;
        tableNumber: number;
        latitude?: number;
        longitude?: number;
        accuracy?: number;
        tableVerificationCode?: string;
      } = {
        cafeId: params.cafeId,
        tableNumber: params.tableNumber,
      };

      if (Number.isFinite(params.latitude)) {
        payload.latitude = Number(params.latitude);
      }
      if (Number.isFinite(params.longitude)) {
        payload.longitude = Number(params.longitude);
      }

      if (Number.isFinite(params.accuracy)) {
        payload.accuracy = Number(params.accuracy);
      }
      const verificationCode = String(params.tableVerificationCode || '').trim();
      if (verificationCode) {
        payload.tableVerificationCode = verificationCode;
      }

      return await fetchAPI<CafeCheckInResponse>(`/cafes/${params.cafeId}/check-in`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    updatePin: async (cafeId: string | number, pin: string, userId?: string | number) => {
      return await fetchAPI(`/cafes/${cafeId}/pin`, {
        method: 'PUT',
        body: JSON.stringify({ pin, userId }),
      });
    },

    updateLocation: async (
      cafeId: string | number,
      params: {
        latitude: number;
        longitude: number;
        radius: number;
        secondaryLatitude?: number | null;
        secondaryLongitude?: number | null;
        secondaryRadius?: number | null;
      }
    ) => {
      return await fetchAPI(`/cafes/${cafeId}/location`, {
        method: 'PUT',
        body: JSON.stringify(params),
      });
    },
  },

  // GAMES
  games: {
    list: async (options?: { tableCode?: string; includeAll?: boolean }): Promise<GameRequest[]> => {
      const query = new URLSearchParams();
      const normalizedTable = String(options?.tableCode || '').trim().toUpperCase();
      if (normalizedTable) {
        query.set('table', normalizedTable);
      }
      if (options?.includeAll) {
        query.set('scope', 'all');
      }
      const suffix = query.toString();
      return await fetchAPI(`/games${suffix ? `?${suffix}` : ''}`);
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

    move: async (
      gameId: number | string,
      data: {
        gameState?: unknown;
        player?: 'host' | 'guest';
        move?: string;
        scoreSubmission?: { username: string; score: number; roundsWon?: number; durationMs?: number };
        liveSubmission?: {
          mode?: string;
          score?: number;
          roundsWon?: number;
          round?: number;
          done?: boolean;
        };
        chessMove?: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' };
      }
    ) => {
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

    drawOffer: async (
      gameId: number | string,
      action: 'offer' | 'accept' | 'reject' | 'cancel'
    ): Promise<{ success: boolean; drawOffer?: unknown; winner?: string | null; draw?: boolean }> => {
      return await fetchAPI(`/games/${gameId}/draw-offer`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
    },

    resign: async (
      gameId: number | string
    ): Promise<{ success: boolean; winner?: string | null; reason?: string }> => {
      return await fetchAPI(`/games/${gameId}/resign`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },

    delete: async (gameId: number | string) => {
      return await fetchAPI(`/games/${gameId}`, {
        method: 'DELETE',
      });
    },

    // REALTIME LISTENERS (Polling-based fallback)
    onGameChange: (gameId: string, callback: (game: GameRequest) => void) => {
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

    onLobbyChange: (callback: (games: GameRequest[]) => void) => {
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
    buy: async (rewardId: string | number): Promise<ShopBuyResponse> => {
      return await fetchAPI('/shop/buy', {
        method: 'POST',
        body: JSON.stringify({ rewardId }),
      });
    },

    inventory: async (userId: string | number): Promise<ShopInventoryRow[]> => {
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
    },

    deleteCafe: async (cafeId: string | number): Promise<DeleteCafeResult> => {
      return await fetchAPI(`/admin/cafes/${cafeId}`, {
        method: 'DELETE',
      });
    },
  },



  // COUPONS (for CafeDashboard)
  coupons: {
    use: async (code: string): Promise<{ success: boolean; item?: CouponUseItem }> => {
      return await fetchAPI('/coupons/use', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    }
  }
};
