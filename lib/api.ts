import { User, GameRequest } from '../types';

// BURASI DEĞİŞTİ:
// Canlıdaysak (PROD) Render linkini kullan, değilsek (DEV) yerel proxy'yi (/api) kullan.
const RENDER_URL = "https://cafeduo-api.onrender.com";
const API_URL = 'https://cafeduo-api.onrender.com/api';

console.log("🚀 Current API URL:", API_URL); // Debugging log

export const api = {
  auth: {
    login: async (email: string, password: string, captchaToken: string): Promise<User> => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Login Error (Non-JSON):", text);
        throw new Error(`Sunucu Hatası (${res.status}): ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Giriş başarısız');
      }
      return data;
    },
    register: async (username: string, email: string, password: string, department?: string, captchaToken?: string): Promise<any> => {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, department, captchaToken }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Register Error (Non-JSON):", text);
        throw new Error(`Sunucu hatası: ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Kayıt başarısız');
      }
      return data;
    },
    verify: async (email: string, code: string): Promise<User> => {
      const res = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Sunucu hatası: ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Doğrulama başarısız');
      }
      return data;
    },
    googleLogin: async (token: string): Promise<User> => {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Sunucu hatası: ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Google girişi başarısız');
      }
      return data;
    }
  },
  games: {
    list: async (): Promise<GameRequest[]> => {
      const res = await fetch(`${API_URL}/games`);
      return res.json();
    },
    get: async (id: number) => {
      const response = await fetch(`${API_URL}/games/${id}`);
      return response.json();
    },
    create: async (game: Partial<GameRequest>): Promise<GameRequest> => {
      const res = await fetch(`${API_URL}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game),
      });
      return res.json();
    },
    join: async (id: number, guestName: string): Promise<void> => {
      await fetch(`${API_URL}/games/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName }),
      });
    },
    move: async (id: number, data: any) => {
      const response = await fetch(`${API_URL}/games/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    finish: async (id: number, winner: string) => {
      const response = await fetch(`${API_URL}/games/${id}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner }),
      });
      return response.json();
    },
    delete: async (id: number) => {
      const response = await fetch(`${API_URL}/games/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    },
  },
  users: {
    update: async (user: User): Promise<User> => {
      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return res.json();
    },
    getActiveGame: async (username: string): Promise<GameRequest | null> => {
      const res = await fetch(`${API_URL}/users/${username}/active-game`);
      return res.json();
    }
  },
  coupons: {
    use: async (code: string) => {
      const response = await fetch(`${API_URL}/coupons/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Sunucu hatası: ${response.status}`);
      }

      if (!response.ok) {
        throw { response: { data } };
      }
      return data;
    }
  },
  admin: {
    createCafeAdmin: async (data: any) => {
      const response = await fetch(`${API_URL}/admin/cafe-admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const text = await response.text();
      let resData;
      try {
        resData = JSON.parse(text);
      } catch (e) {
        throw new Error(`Sunucu hatası: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(resData.error || 'İşlem başarısız');
      }
      return resData;
    },
    getUsers: async () => {
      const response = await fetch(`${API_URL}/admin/users`);
      return response.json();
    },
    getGames: async () => {
      const response = await fetch(`${API_URL}/admin/games`);
      return response.json();
    },
    updateCafe: async (id: number, data: any) => {
      const response = await fetch(`${API_URL}/admin/cafes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    createCafe: async (data: any) => {
      const response = await fetch(`${API_URL}/admin/cafes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    updateUserRole: async (userId: number, role: string) => {
      const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      return response.json();
    }
  },
  cafes: {
    list: async () => {
      const response = await fetch(`${API_URL}/cafes`);
      return response.json();
    },
    checkIn: async (data: { userId: number, cafeId: number, tableNumber: number, pin: string }) => {
      const response = await fetch(`${API_URL}/cafes/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Check-in başarısız');
      }
      return resData;
    },
    updatePin: async (cafeId: number, pin: string) => {
      const response = await fetch(`${API_URL}/cafes/${cafeId}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      return response.json();
    }
  },
  rewards: {
    list: async () => {
      const response = await fetch(`${API_URL}/rewards`);
      return response.json();
    },
    create: async (data: any) => {
      const response = await fetch(`${API_URL}/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    delete: async (id: number) => {
      await fetch(`${API_URL}/rewards/${id}`, { method: 'DELETE' });
    }
  },
  shop: {
    buy: async (userId: number, rewardId: number) => {
      const response = await fetch(`${API_URL}/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rewardId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Satın alma başarısız');
      }
      return data;
    },
    inventory: async (userId: number) => {
      const response = await fetch(`${API_URL}/shop/inventory/${userId}`);
      return response.json();
    }
  }
};