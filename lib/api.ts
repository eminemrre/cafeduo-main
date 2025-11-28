import { User, GameRequest } from '../types';

const API_URL = '/api';

export const api = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Login Error (Non-JSON):", text);
        // Show the actual response text in the error to debug
        throw new Error(`Sunucu Hatası (${res.status}): ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Giriş başarısız');
      }
      return data;
    },
    register: async (username: string, email: string, password: string): Promise<User> => {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
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
    }
  },
  games: {
    list: async (): Promise<GameRequest[]> => {
      const res = await fetch(`${API_URL}/games`);
      return res.json();
    },
    create: async (game: Partial<GameRequest>): Promise<GameRequest> => {
      const res = await fetch(`${API_URL}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game),
      });
      return res.json();
    },
    join: async (id: number): Promise<void> => {
      await fetch(`${API_URL}/games/${id}/join`, { method: 'POST' });
    }
  },
  users: {
    update: async (user: User): Promise<User> => {
      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
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
    }
  },
  cafes: {
    list: async () => {
      const response = await fetch(`${API_URL}/cafes`);
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
  }
};