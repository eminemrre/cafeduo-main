/**
 * useGames Hook
 * 
 * @description Oyun listesi ve aktif oyun yönetimi için custom hook
 * @returns Oyun verileri ve yönetim fonksiyonları
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameHistoryEntry, GameRequest, User } from '../types';
import { api } from '../lib/api';
import { socketService } from '../lib/socket';

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
  createGame: (
    gameType: string,
    points: number,
    options?: { chessClock?: { baseSeconds: number; incrementSeconds: number; label: string } }
  ) => Promise<void>;
  joinGame: (gameId: number) => Promise<void>;
  cancelGame: (gameId: number | string) => Promise<void>;
  leaveGame: () => void;
  setActiveGame: (gameId: string | number | null, gameType?: string, opponent?: string, bot?: boolean) => void;
}

const toMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const isNotFoundError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const message = String(err.message || '').toLowerCase();
  return (
    message.includes('404') ||
    message.includes('bulunamadı') ||
    message.includes('not found')
  );
};

const normalizeTableCode = (rawValue: unknown): string => {
  const raw = String(rawValue || '').trim().toUpperCase();
  if (!raw || raw === 'NULL' || raw === 'UNDEFINED') return '';
  if (raw.startsWith('MASA')) return raw;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `MASA${String(numeric).padStart(2, '0')}`;
  }
  return raw;
};

const gameSnapshot = (game: Partial<GameRequest>) => ({
  id: String(game.id ?? ''),
  hostName: String(game.hostName ?? ''),
  guestName: String(game.guestName ?? ''),
  gameType: String(game.gameType ?? ''),
  points: Number(game.points ?? 0),
  table: String(game.table ?? ''),
  status: String(game.status ?? ''),
  createdAt: String((game as { createdAt?: unknown }).createdAt ?? ''),
});

const isSameGameList = (prev: GameRequest[], next: GameRequest[]) => {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = gameSnapshot(prev[i]);
    const b = gameSnapshot(next[i]);
    if (
      a.id !== b.id ||
      a.hostName !== b.hostName ||
      a.guestName !== b.guestName ||
      a.gameType !== b.gameType ||
      a.points !== b.points ||
      a.table !== b.table ||
      a.status !== b.status ||
      a.createdAt !== b.createdAt
    ) {
      return false;
    }
  }
  return true;
};

const historySnapshot = (entry: Partial<GameHistoryEntry>) => ({
  id: String(entry.id ?? ''),
  gameType: String(entry.gameType ?? ''),
  points: Number(entry.points ?? 0),
  status: String(entry.status ?? ''),
  table: String(entry.table ?? ''),
  opponentName: String(entry.opponentName ?? ''),
  winner: String(entry.winner ?? ''),
  didWin: Boolean(entry.didWin),
  createdAt: String(entry.createdAt ?? ''),
  moveCount: Number(entry.moveCount ?? 0),
  chessTempo: String(entry.chessTempo ?? ''),
});

const isSameHistory = (prev: GameHistoryEntry[], next: GameHistoryEntry[]) => {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = historySnapshot(prev[i]);
    const b = historySnapshot(next[i]);
    if (
      a.id !== b.id ||
      a.gameType !== b.gameType ||
      a.points !== b.points ||
      a.status !== b.status ||
      a.table !== b.table ||
      a.opponentName !== b.opponentName ||
      a.winner !== b.winner ||
      a.didWin !== b.didWin ||
      a.createdAt !== b.createdAt ||
      a.moveCount !== b.moveCount ||
      a.chessTempo !== b.chessTempo
    ) {
      return false;
    }
  }
  return true;
};

const isSameActiveGame = (a: GameRequest | null, b: GameRequest | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const left = gameSnapshot(a);
  const right = gameSnapshot(b);
  return (
    left.id === right.id &&
    left.status === right.status &&
    left.hostName === right.hostName &&
    left.guestName === right.guestName &&
    left.gameType === right.gameType &&
    left.table === right.table
  );
};

const normalizeGameId = (game: Partial<GameRequest>): string => String(game.id ?? '').trim();

const normalizeLobbyList = (
  data: unknown,
  resolvedTableCode: string
): GameRequest[] => {
  if (!Array.isArray(data)) return [];

  const seenIds = new Set<string>();
  return data
    .filter((item): item is GameRequest => typeof item === 'object' && item !== null)
    .filter((game) => String(game.status || '').toLowerCase() === 'waiting')
    .filter((game) => {
      const id = normalizeGameId(game);
      if (!id || id === 'undefined' || id === 'null') {
        return false;
      }
      if (seenIds.has(id)) {
        return false;
      }
      seenIds.add(id);
      return true;
    })
    .sort((left, right) => {
      const leftSameTable = normalizeTableCode(left.table) === resolvedTableCode ? 1 : 0;
      const rightSameTable = normalizeTableCode(right.table) === resolvedTableCode ? 1 : 0;
      if (leftSameTable !== rightSameTable) {
        return rightSameTable - leftSameTable;
      }
      const leftCreatedAt = new Date(String((left as { createdAt?: unknown }).createdAt || 0)).getTime();
      const rightCreatedAt = new Date(String((right as { createdAt?: unknown }).createdAt || 0)).getTime();
      return rightCreatedAt - leftCreatedAt;
    });
};

export function useGames({ currentUser, tableCode }: UseGamesProps): UseGamesReturn {
  const resolvedTableCode = normalizeTableCode(tableCode || currentUser.table_number);
  const isAdminActor = currentUser.role === 'admin' || currentUser.isAdmin === true;

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const missingActivePollCountRef = useRef(0);
  const pollTickRef = useRef(0);
  const activeGameIdRef = useRef<string | number | null>(null);
  const gamesRequestInFlightRef = useRef(false);
  const activeGameRequestInFlightRef = useRef(false);
  const historyRequestInFlightRef = useRef(false);
  const autoJoinCooldownUntilRef = useRef(0);

  useEffect(() => {
    activeGameIdRef.current = activeGameId;
  }, [activeGameId]);

  /**
   * Oyun listesini API'den çek
   */
  const fetchGames = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (gamesRequestInFlightRef.current) return;
    gamesRequestInFlightRef.current = true;
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await api.games.list({
        tableCode: resolvedTableCode,
        includeAll: isAdminActor || Boolean(resolvedTableCode),
      });
      const list = normalizeLobbyList(data, resolvedTableCode);
      setGames((prev) => (isSameGameList(prev, list) ? prev : list));
      setError((prev) => (prev ? null : prev));
    } catch (err) {
      console.error('Failed to load games:', err);
      if (!silent) {
        setError('Oyunlar yüklenemedi');
      }
    } finally {
      gamesRequestInFlightRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [resolvedTableCode, isAdminActor]);

  /**
   * Kullanıcının tamamlanmış oyun geçmişini çek
   */
  const fetchGameHistory = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (historyRequestInFlightRef.current) return;
    historyRequestInFlightRef.current = true;
    try {
      if (!silent) {
        setHistoryLoading(true);
      }
      const history = await api.users.getGameHistory(currentUser.username);
      const list = Array.isArray(history) ? history : [];
      setGameHistory((prev) => (isSameHistory(prev, list) ? prev : list));
    } catch (err) {
      console.error('Failed to load game history:', err);
      if (!silent) {
        setGameHistory([]);
      }
    } finally {
      historyRequestInFlightRef.current = false;
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
    if (activeGameRequestInFlightRef.current) return;
    activeGameRequestInFlightRef.current = true;
    
    try {
      const game = await api.users.getActiveGame(currentUser.username);
      if (game) {
        missingActivePollCountRef.current = 0;
        setServerActiveGame((prev) => (isSameActiveGame(prev, game) ? prev : game));
        return;
      }

      // Polling sırasında tek seferlik null cevaplarda banner'ı hemen düşürme.
      if (options?.preserveUntilConfirmedEmpty) {
        missingActivePollCountRef.current += 1;
        if (missingActivePollCountRef.current < 2) return;
      }

      missingActivePollCountRef.current = 0;
      setServerActiveGame((prev) => (prev === null ? prev : null));
    } catch (err) {
      console.error('Failed to check active game:', err);
    } finally {
      activeGameRequestInFlightRef.current = false;
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
  const createGame = useCallback(async (
    gameType: string,
    points: number,
    options?: { chessClock?: { baseSeconds: number; incrementSeconds: number; label: string } }
  ) => {
    try {
      const newGame = await api.games.create({
        hostName: currentUser.username,
        gameType,
        points,
        table: tableCode || currentUser.table_number || 'MASA00',
        ...(options?.chessClock ? { chessClock: options.chessClock } : {}),
      });

      // Oyun listesine ekle
      setGames((prev) => [newGame, ...prev]);

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
      setGames((prev) => prev.filter((game) => String(game.id) !== String(gameId)));

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
      setGames((prev) => prev.filter((game) => String(game.id) !== String(gameId)));
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
      if (isNotFoundError(err)) {
        // Yarış koşulu: oyun bu sırada başka bir istemci tarafından düşmüş olabilir.
        setGames((prev) => prev.filter((game) => String(game.id) !== String(gameId)));
        await Promise.all([
          fetchGames({ silent: true }),
          checkActiveGame({ ignoreLocalActive: true }),
          fetchGameHistory({ silent: true }),
        ]);
        return;
      }
      console.error('Failed to cancel game:', err);
      throw new Error(toMessage(err, 'Oyun iptal edilirken hata oluştu'));
    }
  }, [activeGameId, checkActiveGame, fetchGameHistory, fetchGames]);

  /**
   * Oyundan ayrıl
   */
  const leaveGame = useCallback(() => {
    autoJoinCooldownUntilRef.current = Date.now() + 5000;

    setActiveGameId(null);
    setActiveGameType('');
    setOpponentName(undefined);
    setIsBot(false);
    missingActivePollCountRef.current = 0;

    // Oyundan çıkınca rejoin bilgisini anında tazele.
    void checkActiveGame({ ignoreLocalActive: true });
  }, [checkActiveGame]);

  /**
   * Aktif oyunu manuel olarak ayarla
   */
  const setActiveGame = useCallback((
    gameId: string | number | null,
    gameType: string = '',
    opponent?: string,
    bot: boolean = false
  ) => {
    if (gameId) {
      autoJoinCooldownUntilRef.current = 0;
    }
    setActiveGameId(gameId);
    setActiveGameType(gameType);
    setOpponentName(opponent);
    setIsBot(bot);
    if (gameId) {
      setServerActiveGame(null);
      missingActivePollCountRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (activeGameId || !serverActiveGame) return;
    if (Date.now() < autoJoinCooldownUntilRef.current) return;

    const resolvedId = String(serverActiveGame.id ?? '').trim();
    if (!resolvedId || resolvedId === 'undefined' || resolvedId === 'null') {
      return;
    }

    const actor = String(currentUser.username || '').trim().toLowerCase();
    const host = String(serverActiveGame.hostName || '').trim();
    const guest = String(serverActiveGame.guestName || '').trim();
    const resolvedOpponent =
      host.toLowerCase() === actor
        ? guest || undefined
        : host || undefined;

    setActiveGameId(serverActiveGame.id);
    setActiveGameType(String(serverActiveGame.gameType || ''));
    setOpponentName(resolvedOpponent);
    setIsBot(false);
    setServerActiveGame(null);
    missingActivePollCountRef.current = 0;
  }, [activeGameId, currentUser.username, serverActiveGame]);

  /**
   * İlk yükleme ve polling
   */
  useEffect(() => {
    // İlk yükleme
    void fetchGames();
    void checkActiveGame();
    void fetchGameHistory();

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void fetchGames({ silent: true });
        void checkActiveGame({ ignoreLocalActive: true });
        void fetchGameHistory({ silent: true });
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Polling başlat (4 saniyede bir)
    if (typeof setInterval === 'function') {
      intervalRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        if (activeGameIdRef.current) {
          return;
        }

        pollTickRef.current += 1;
        void fetchGames({ silent: true });
        void checkActiveGame({ preserveUntilConfirmedEmpty: true });

        // Geçmiş listesi daha ağır bir sorgu; daha seyrek güncelle.
        if (pollTickRef.current % 4 === 0) {
          void fetchGameHistory({ silent: true });
        }
      }, 4000);
    }

    // Cleanup
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (intervalRef.current !== null && typeof clearInterval === 'function') {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchGames, checkActiveGame, fetchGameHistory]);

  /**
   * Socket tabanlı lobi senkronu (polling'e ek)
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'test') return;

    const socket = socketService.getSocket();
    const handleLobbyUpdated = () => {
      void fetchGames({ silent: true });
      void checkActiveGame({ ignoreLocalActive: true, preserveUntilConfirmedEmpty: true });
      void fetchGameHistory({ silent: true });
    };

    socket.on('lobby_updated', handleLobbyUpdated);
    return () => {
      socket.off('lobby_updated', handleLobbyUpdated);
    };
  }, [checkActiveGame, fetchGameHistory, fetchGames]);

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
