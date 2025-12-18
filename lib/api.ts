// API Layer - Now using Firebase
import { firebaseAuth, firebaseUsers, firebaseCafes, firebaseGames, firebaseRewards } from './firebase';

// Re-export Firebase functions as the main API
export const api = {
  // AUTH
  auth: {
    login: async (email: string, password: string) => {
      return await firebaseAuth.login(email, password);
    },
    register: async (username: string, email: string, password: string) => {
      return await firebaseAuth.register(email, password, username);
    },
    googleLogin: async () => {
      return await firebaseAuth.googleLogin();
    },
    logout: async () => {
      return await firebaseAuth.logout();
    }
  },

  // USERS
  users: {
    get: async (userId: string) => {
      return await firebaseUsers.get(userId);
    },
    update: async (userData: any) => {
      return await firebaseUsers.update(userData.id, userData);
    },
    getActiveGame: async (username: string) => {
      // Check if user has an active game
      const games = await firebaseGames.getAll();
      return games.find((g: any) => g.hostName === username || g.guestName === username) || null;
    }
  },

  // CAFES
  cafes: {
    list: async () => {
      return await firebaseCafes.getAll();
    },
    get: async (cafeId: string) => {
      return await firebaseCafes.get(cafeId);
    },
    checkIn: async (params: { userId: string | number; cafeId: string | number; tableNumber: number; pin: string }) => {
      return await firebaseCafes.checkIn(
        params.userId.toString(),
        params.cafeId.toString(),
        params.tableNumber,
        params.pin
      );
    },
    updatePin: async (cafeId: string, pin: string, userId?: string) => {
      return await firebaseCafes.updatePin(cafeId.toString(), pin);
    }
  },

  // GAMES
  games: {
    list: async () => {
      return await firebaseGames.getAll();
    },
    get: async (gameId: number | string) => {
      return await firebaseGames.get(gameId.toString());
    },
    create: async (data: any) => {
      return await firebaseGames.create(data);
    },
    join: async (gameId: number | string, guestName: string) => {
      await firebaseGames.join(gameId.toString(), guestName);
      return await firebaseGames.get(gameId.toString());
    },
    move: async (gameId: number | string, data: any) => {
      await firebaseGames.updateState(gameId.toString(), data.gameState);
    },
    finish: async (gameId: number | string, winner: string) => {
      await firebaseGames.finish(gameId.toString(), winner);
    },
    delete: async (gameId: number | string) => {
      await firebaseGames.delete(gameId.toString());
    },
    // REALTIME LISTENERS
    onGameChange: firebaseGames.onGameChange,
    onLobbyChange: firebaseGames.onLobbyChange
  },

  // REWARDS / SHOP
  rewards: {
    list: async () => {
      return await firebaseRewards.getAll();
    }
  },

  shop: {
    buy: async (userId: string, rewardId: string | number) => {
      return await firebaseRewards.buy(userId, rewardId.toString());
    },
    inventory: async (userId: string) => {
      return await firebaseRewards.getUserItems(userId);
    }
  },

  // LEADERBOARD
  leaderboard: {
    get: async () => {
      return await firebaseUsers.getLeaderboard(10);
    }
  }
};

// Export Firebase auth for direct access if needed
export { firebaseAuth } from './firebase';