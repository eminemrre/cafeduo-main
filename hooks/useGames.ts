/**
 * useGames Hook
 * 
 * @description Oyun listesi ve aktif oyun yönetimi için custom hook
 * @returns Oyun verileri ve yönetim fonksiyonları
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameHistoryEntry, GameRequest, User } from '../types';
import { api } from '../lib/api';

interface UseGamesProps {
  currentUser: User;
  tableCode: string;
}

interface UseGamesReturn {
  // Oyun listesi
  games: GameRequest[];
  loading: boolean;
  error: string | null;
  gameHistory: GameHistoryEntry[];
  historyLoading: boolean;
  refetch: () => Promise<void>;
  
  // Aktif oyun
  activeGameId: string | number | null;
  activeGameType: string;
  opponentName: string | undefined;
  isBot: boolean;
  serverActiveGame: GameRequest | null;
  
  // Oyun yönetimi
  createGame: (gameType: string, points: number) => Promise<void>;
  joinGame: (gameId: number) => Promise<void>;
  cancelGame: (gameId: number | string) => Promise<void>;
  leaveGame: () => void;
  setActiveGame: (gameId: string | number | null, gameType?: string, opponent?: string, bot?: boolean) => void;
}

const toMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export function useGames({ currentUser, tableCode }: UseGamesProps): UseGamesReturn {
  // Oyun listesi state'leri
  const [games, setGames] = useState<GameRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Aktif oyun state'leri
  const [activeGameId, setActiveGameId] = useState<string | number | null>(null);
  const [activeGameType, setActiveGameType] = useState<string>('');
  const [opponentName, setOpponentName] = useState<string | undefined>(undefined);
  const [isBot, setIsBot] = useState<boolean>(false);
  const [serverActiveGame, setServerActiveGame] = useState<GameRequest | null>(null);
  
  // Polling interval ref'i
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const missingActivePollCountRef = useRef(0);

  /**
   * Oyun listesini API'den çek
   */
  const fetchGames = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await api.games.list();
      const list = Array.isArray(data) ? data : [];
      setGames(list);
      setError(null);
    } catch (err) {
      console.error('Failed to load games:', err);
      setError('Oyunlar yüklenemedi');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Kullanıcının tamamlanmış oyun geçmişini çek
   */
  const fetchGameHistory = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    try {
      if (!silent) {
        setHistoryLoading(true);
      }
      const history = await api.users.getGameHistory(currentUser.username);
      setGameHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      console.error('Failed to load game history:', err);
      setGameHistory([]);
    } finally {
      if (!silent) {
        setHistoryLoading(false);
      }
    }
  }, [currentUser.username]);

  /**
   * Kullanıcının aktif oyununu kontrol et
   */
  const checkActiveGame = useCallback(async (options?: { preserveUntilConfirmedEmpty?: boolean; ignoreLocalActive?: boolean }) => {
    // Eğer lokalde aktif oyun varsa, server'dan gelen null ile üzerine yazma
    if (activeGameId && !options?.ignoreLocalActive) return;
    
    try {
      const game = await api.users.getActiveGame(currentUser.username);
      if (game) {
        missingActivePollCountRef.current = 0;
        setServerActiveGame(game);
        return;
      }

      // Polling sırasında tek seferlik null cevaplarda banner'ı hemen düşürme.
      if (options?.preserveUntilConfirmedEmpty) {
        missingActivePollCountRef.current += 1;
        if (missingActivePollCountRef.current < 2) return;
      }

      missingActivePollCountRef.current = 0;
      setServerActiveGame(null);
    } catch (err) {
      console.error('Failed to check active game:', err);
    }
  }, [currentUser.username, activeGameId]);

  /**
   * Oyun listesini yenile
   */
  const refetch = useCallback(async () => {
    await Promise.all([
      fetchGames(),
      checkActiveGame(),
      fetchGameHistory(),
    ]);
  }, [fetchGames, checkActiveGame, fetchGameHistory]);

  /**
   * Yeni oyun kur
   */
  const createGame = useCallback(async (gameType: string, points: number) => {
    try {
      const newGame = await api.games.create({
        hostName: currentUser.username,
        gameType,
        points,
        table: tableCode || currentUser.table_number || 'MASA00'
      });

      // Oyun listesine ekle
      setGames(prev => [newGame, ...prev]);

      // Host doğrudan oyuna alınmaz; lobby'de bekler.
      // Rakip katıldığında active-game endpoint'i üzerinden geri döner.
      setActiveGameId(null);
      setActiveGameType('');
      setOpponentName(undefined);
      setIsBot(false);
      await Promise.all([
        fetchGames({ silent: true }),
        fetchGameHistory({ silent: true }),
      ]);
    } catch (err) {
      console.error('Failed to create game:', err);
      throw new Error(toMessage(err, 'Oyun kurulurken hata oluştu'));
    }
  }, [currentUser.username, currentUser.table_number, tableCode, fetchGames, fetchGameHistory]);

  /**
   * Mevcut oyuna katıl
   */
  const joinGame = useCallback(async (gameId: number) => {
    try {
      await api.games.join(gameId, currentUser.username);

      // Katılım sonrası güncel oyunu sunucudan al
      const joinedGame = await api.games.get(gameId);
      const gameType = joinedGame?.gameType || games.find(g => g.id === gameId)?.gameType || '';
      const hostName = joinedGame?.hostName || games.find(g => g.id === gameId)?.hostName;

      setActiveGameId(gameId);
      setActiveGameType(gameType);
      setOpponentName(hostName);
      setIsBot(false);
      setServerActiveGame(null);
      missingActivePollCountRef.current = 0;

      // Lobi listesini tazele (oyun waiting listesinden düşmeli)
      await Promise.all([
        fetchGames({ silent: true }),
        fetchGameHistory({ silent: true }),
      ]);
    } catch (err) {
      console.error('Failed to join game:', err);
      throw new Error(toMessage(err, 'Oyuna katılırken hata oluştu'));
    }
  }, [currentUser.username, games, fetchGames, fetchGameHistory]);

  /**
   * Bekleyen oyunu iptal et
   */
  const cancelGame = useCallback(async (gameId: number | string) => {
    try {
      await api.games.delete(gameId);
      if (String(activeGameId) === String(gameId)) {
        setActiveGameId(null);
        setActiveGameType('');
        setOpponentName(undefined);
        setIsBot(false);
      }

      await Promise.all([
        fetchGames({ silent: true }),
        checkActiveGame({ ignoreLocalActive: true }),
        fetchGameHistory({ silent: true }),
      ]);
    } catch (err) {
      console.error('Failed to cancel game:', err);
      throw new Error(toMessage(err, 'Oyun iptal edilirken hata oluştu'));
    }
  }, [activeGameId, checkActiveGame, fetchGameHistory, fetchGames]);

  /**
   * Oyundan ayrıl
   */
  const leaveGame = useCallback(() => {
    const fallbackTable =
      tableCode ||
      currentUser.table_number ||
      'MASA00';

    if (activeGameId) {
      setServerActiveGame((prev) =>
        prev ?? {
          id: activeGameId,
          hostName: currentUser.username,
          guestName: opponentName,
          gameType: activeGameType || 'Oyun',
          points: 0,
          table: fallbackTable,
          status: 'active',
        }
      );
    }

    setActiveGameId(null);
    setActiveGameType('');
    setOpponentName(undefined);
    setIsBot(false);
    missingActivePollCountRef.current = 0;

    // Oyundan çıkınca rejoin bilgisini anında tazele.
    void checkActiveGame({ ignoreLocalActive: true });
  }, [
    activeGameId,
    activeGameType,
    checkActiveGame,
    currentUser.table_number,
    currentUser.username,
    opponentName,
    tableCode,
  ]);

  /**
   * Aktif oyunu manuel olarak ayarla
   */
  const setActiveGame = useCallback((
    gameId: string | number | null,
    gameType: string = '',
    opponent?: string,
    bot: boolean = false
  ) => {
    setActiveGameId(gameId);
    setActiveGameType(gameType);
    setOpponentName(opponent);
    setIsBot(bot);
    if (gameId) {
      setServerActiveGame(null);
      missingActivePollCountRef.current = 0;
    }
  }, []);

  /**
   * İlk yükleme ve polling
   */
  useEffect(() => {
    // İlk yükleme
    fetchGames();
    checkActiveGame();
    fetchGameHistory();

    // Polling başlat (5 saniyede bir)
    intervalRef.current = setInterval(() => {
      fetchGames({ silent: true });
      checkActiveGame({ preserveUntilConfirmedEmpty: true });
      fetchGameHistory({ silent: true });
    }, 5000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchGames, checkActiveGame, fetchGameHistory]);

  return {
    // Oyun listesi
    games,
    loading,
    error,
    gameHistory,
    historyLoading,
    refetch,
    
    // Aktif oyun
    activeGameId,
    activeGameType,
    opponentName,
    isBot,
    serverActiveGame,
    
    // Oyun yönetimi
    createGame,
    joinGame,
    cancelGame,
    leaveGame,
    setActiveGame
  };
}
