import { act, renderHook, waitFor } from '@testing-library/react';
import { useLiveScoreGame, type LiveActionResult } from './useLiveScoreGame';
import { api } from '../lib/api';
import { socketService } from '../lib/socket';
import type { CompetitiveEngineState, CompetitiveGame, User } from '../types';

jest.mock('../lib/api', () => ({
  api: {
    games: {
      get: jest.fn(),
      action: jest.fn(),
    },
  },
}));

jest.mock('../lib/socket', () => {
  const listeners: Record<string, Array<(payload: unknown) => void>> = {};
  const socket = {
    on: jest.fn((event: string, callback: (payload: unknown) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(callback);
    }),
    off: jest.fn((event: string, callback: (payload: unknown) => void) => {
      listeners[event] = (listeners[event] || []).filter((entry) => entry !== callback);
    }),
    emit: (event: string, payload: unknown) => {
      (listeners[event] || []).forEach((callback) => callback(payload));
    },
  };
  return {
    socketService: {
      getSocket: jest.fn(() => socket),
      joinGame: jest.fn(),
      leaveGame: jest.fn(),
    },
  };
});

const mockApi = api as unknown as {
  games: { get: jest.Mock; action: jest.Mock };
};
const mockSocketService = socketService as unknown as {
  getSocket: jest.Mock;
  joinGame: jest.Mock;
  leaveGame: jest.Mock;
};

const buildUser = (username = 'alice'): User =>
  ({ id: 1, username, email: 'a@b.c', points: 0 }) as unknown as User;

const now = Date.now();

const buildEngine = (overrides: Partial<CompetitiveEngineState> = {}): CompetitiveEngineState => ({
  version: 2,
  kind: 'quiz',
  revision: 1,
  phase: 'open',
  roundIndex: 1,
  totalRounds: 10,
  startedAt: new Date(now).toISOString(),
  phaseEndsAt: new Date(now + 15_000).toISOString(),
  updatedAt: new Date(now).toISOString(),
  players: {
    host: { name: 'alice', score: 0, correct: 0, streak: 0, answered: false, jokerUsed: false },
    guest: { name: 'bob', score: 0, correct: 0, streak: 0, answered: false, jokerUsed: false },
  },
  round: {
    id: 'r1',
    index: 1,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + 15_000).toISOString(),
    question: 'Soru?',
    options: ['A', 'B', 'C', 'D'],
    category: 'Genel',
    level: 'orta',
  },
  result: null,
  ...overrides,
});

const buildSnapshot = (overrides: Partial<CompetitiveGame> = {}): CompetitiveGame => ({
  id: 'game-1',
  hostName: 'alice',
  guestName: 'bob',
  gameType: 'Bilgi Yarışı',
  points: 10,
  table: 'MASA01',
  status: 'active',
  protocolVersion: 2,
  serverNow: new Date().toISOString(),
  gameState: { engine: buildEngine() },
  ...overrides,
});

const renderLearningHook = (overrides: Partial<Parameters<typeof useLiveScoreGame>[0]> = {}) => {
  const onGameEnd = jest.fn();
  const hook = renderHook(() =>
    useLiveScoreGame({
      currentUser: buildUser(),
      gameId: 'game-1',
      isBot: false,
      mode: 'Bilgi Yarışı',
      statsKind: 'quiz',
      onGameEnd,
      ...overrides,
    })
  );
  return { ...hook, onGameEnd };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.games.get.mockResolvedValue(buildSnapshot());
});

describe('useLiveScoreGame (protocol v2)', () => {
  it('refetches actor-only fleet after a shared placement-to-battle notification', async () => {
    const placement = buildSnapshot({
      gameType: 'Amiral Battı',
      gameState: { engine: buildEngine({ kind: 'battleship', phase: 'placement' }) },
    });
    mockApi.games.get.mockResolvedValueOnce(placement);
    const { result } = renderLearningHook({ mode: 'Amiral Battı', statsKind: 'battleship' });
    await waitFor(() => expect(result.current.engine?.kind).toBe('battleship'));
    const battle = buildEngine({
      kind: 'battleship',
      phase: 'battle',
      revision: 2,
      players: {
        host: { name: 'alice', score: 0, placed: true, autoPlaced: true },
        guest: { name: 'bob', score: 0, placed: true },
      },
    });
    mockApi.games.get.mockResolvedValue(
      buildSnapshot({
        gameType: 'Amiral Battı',
        actorView: { fleet: [{ size: 4, cells: [0, 1, 2, 3] }] },
        gameState: { engine: battle },
      })
    );
    act(() => {
      mockSocketService
        .getSocket()
        .emit('game_state_updated', { gameId: 'game-1', gameState: { engine: battle } });
    });
    await waitFor(() => expect(result.current.snapshot?.actorView?.fleet).toHaveLength(1));
    expect(mockApi.games.get).toHaveBeenCalledTimes(2);
  });
  it('refetches the hangman board when a socket update opens a new round', async () => {
    const roundOf = (id: string, index: number) => ({
      id,
      index,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      length: 5,
    });
    const board = (roundId: string) => ({
      hangman: {
        roundId,
        pattern: [] as (string | null)[],
        guessed: [] as string[],
        wrong: 0,
        solved: false,
        done: false,
        points: 0,
      },
    });
    const first = buildEngine({ kind: 'hangman', phase: 'open', round: roundOf('r1', 0) });
    mockApi.games.get.mockResolvedValueOnce(
      buildSnapshot({ gameType: 'Adam Asmaca', actorView: board('r1'), gameState: { engine: first } })
    );
    const { result } = renderLearningHook({ mode: 'Adam Asmaca', statsKind: 'hangman' });
    await waitFor(() => expect(result.current.engine?.kind).toBe('hangman'));

    // The opponent's letter on the same round: the actor's board did not change.
    act(() => {
      mockSocketService.getSocket().emit('game_state_updated', {
        gameId: 'game-1',
        gameState: { engine: { ...first, revision: 2 } },
      });
    });
    expect(mockApi.games.get).toHaveBeenCalledTimes(1);

    const second = buildEngine({ kind: 'hangman', phase: 'open', revision: 3, round: roundOf('r2', 1) });
    mockApi.games.get.mockResolvedValue(
      buildSnapshot({ gameType: 'Adam Asmaca', actorView: board('r2'), gameState: { engine: second } })
    );
    act(() => {
      mockSocketService
        .getSocket()
        .emit('game_state_updated', { gameId: 'game-1', gameState: { engine: second } });
    });
    await waitFor(() => expect(result.current.snapshot?.actorView?.hangman?.roundId).toBe('r2'));
    expect(mockApi.games.get).toHaveBeenCalledTimes(2);
  });

  it('queues a refetch asked for while another snapshot request is in flight', async () => {
    mockApi.games.get.mockResolvedValueOnce(buildSnapshot());
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.engine?.round?.id).toBe('r1'));
    let release: (value: CompetitiveGame) => void = () => undefined;
    mockApi.games.get
      .mockImplementationOnce(() => new Promise<CompetitiveGame>((resolve) => (release = resolve)))
      .mockResolvedValue(buildSnapshot());
    const calls = mockApi.games.get.mock.calls.length;
    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.fetchSnapshot(true);
    });
    await act(async () => {
      expect(await result.current.fetchSnapshot(true)).toBeNull();
    });
    expect(mockApi.games.get.mock.calls.length).toBe(calls + 1);
    await act(async () => {
      release(buildSnapshot());
      await first;
    });
    await waitFor(() => expect(mockApi.games.get.mock.calls.length).toBe(calls + 2));
  });

  it('does not touch the network in bot mode', async () => {
    const { result, onGameEnd } = renderLearningHook({ isBot: true, gameId: 'game-1' });
    expect(result.current.playerScore).toBe(0);
    expect(result.current.done).toBe(false);
    await act(async () => {
      expect(await result.current.fetchSnapshot()).toBeNull();
      expect(await result.current.submitAction({ type: 'answer', optionIndex: 0 })).toEqual(
        expect.objectContaining({ ok: false, code: 'NOT_MULTIPLAYER' })
      );
    });
    expect(mockApi.games.get).not.toHaveBeenCalled();
    expect(mockApi.games.action).not.toHaveBeenCalled();
    expect(onGameEnd).not.toHaveBeenCalled();
  });

  it('applies a verified snapshot and resolves the actor side', async () => {
    mockApi.games.get.mockResolvedValue(
      buildSnapshot({
        gameState: {
          engine: buildEngine({
            players: {
              host: {
                name: 'alice',
                score: 4,
                correct: 2,
                streak: 1,
                answered: true,
                jokerUsed: false,
              },
              guest: {
                name: 'bob',
                score: 6,
                correct: 3,
                streak: 2,
                answered: true,
                jokerUsed: true,
              },
            },
          }),
        },
      })
    );
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.engine).not.toBeNull());
    expect(result.current.actorKey).toBe('host');
    expect(result.current.playerScore).toBe(4);
    expect(result.current.opponentScore).toBe(6);
    expect(result.current.player?.correct).toBe(2);
    expect(result.current.guestName).toBe('bob');
  });

  it('ignores an older revision from a poll and from a socket event', async () => {
    mockApi.games.get.mockResolvedValue(
      buildSnapshot({
        gameState: {
          engine: buildEngine({
            revision: 5,
            players: {
              host: { name: 'alice', score: 3, answered: false },
              guest: { name: 'bob', score: 1, answered: false },
            },
          }),
        },
      })
    );
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.playerScore).toBe(3));

    mockApi.games.get.mockResolvedValue(
      buildSnapshot({
        gameState: {
          engine: buildEngine({
            revision: 4,
            players: {
              host: { name: 'alice', score: 99, answered: false },
              guest: { name: 'bob', score: 99, answered: false },
            },
          }),
        },
      })
    );
    await act(async () => {
      await result.current.fetchSnapshot();
    });
    expect(result.current.playerScore).toBe(3);
    expect(result.current.opponentScore).toBe(1);

    const socket = mockSocketService.getSocket();
    act(() => {
      socket.emit('game_state_updated', {
        gameId: 'game-1',
        status: 'active',
        gameState: {
          engine: buildEngine({
            revision: 4,
            players: {
              host: { name: 'alice', score: 99, answered: false },
              guest: { name: 'bob', score: 99, answered: false },
            },
          }),
        },
      });
    });
    expect(result.current.playerScore).toBe(3);
  });

  it('applies a newer socket snapshot without a refetch', async () => {
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.engine).not.toBeNull());
    const callsBefore = mockApi.games.get.mock.calls.length;
    const socket = mockSocketService.getSocket();
    act(() => {
      socket.emit('game_state_updated', {
        gameId: 'game-1',
        status: 'active',
        gameState: {
          engine: buildEngine({
            revision: 2,
            players: {
              host: { name: 'alice', score: 7, answered: true },
              guest: { name: 'bob', score: 2, answered: false },
            },
          }),
        },
      });
    });
    expect(result.current.playerScore).toBe(7);
    expect(result.current.opponentScore).toBe(2);
    expect(mockApi.games.get.mock.calls.length).toBe(callsBefore);
  });

  it('reuses the same actionId after a network failure', async () => {
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.engine?.round?.id).toBe('r1'));

    mockApi.games.action.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      success: true,
      game: buildSnapshot({
        gameState: {
          engine: buildEngine({
            revision: 2,
            phase: 'reveal',
            round: {
              ...buildEngine().round!,
              correctIndex: 1,
              picks: { host: 1, guest: null },
              scoreDelta: { host: 18, guest: 0 },
            },
            players: {
              host: { name: 'alice', score: 18, answered: true },
              guest: { name: 'bob', score: 0, answered: false },
            },
          }),
        },
      }),
    });

    let first: LiveActionResult | undefined;
    await act(async () => {
      first = await result.current.submitAction({ type: 'answer', optionIndex: 1 });
    });
    expect(first).toEqual(expect.objectContaining({ ok: false, code: 'NETWORK' }));
    expect(result.current.error).toMatch(/ulaşmadı/);

    let second: LiveActionResult | undefined;
    await act(async () => {
      second = await result.current.submitAction({ type: 'answer', optionIndex: 1 });
    });
    expect(second?.ok).toBe(true);

    const firstPayload = mockApi.games.action.mock.calls[0][1];
    const secondPayload = mockApi.games.action.mock.calls[1][1];
    expect(secondPayload).toEqual(firstPayload);
    expect(firstPayload).toEqual(
      expect.objectContaining({ roundId: 'r1', type: 'answer', optionIndex: 1 })
    );
    expect(result.current.playerScore).toBe(18);
    expect(result.current.pending).toBe(false);
  });

  it('sends hangman letters and words, retrying a letter with its first action id', async () => {
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.engine?.round?.id).toBe('r1'));
    mockApi.games.action
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ success: true, game: buildSnapshot() });

    await act(async () => {
      await result.current.submitAction({ type: 'guess', letter: 'ş' });
    });
    await act(async () => {
      await result.current.submitAction({ type: 'guess', letter: 'ş' });
    });
    await act(async () => {
      await result.current.submitAction({ type: 'guess', letter: 'a' });
    });
    await act(async () => {
      await result.current.submitAction({ type: 'solve', word: 'kahve' });
    });

    const [first, retry, other, solve] = mockApi.games.action.mock.calls.map((call) => call[1]);
    expect(first).toEqual(expect.objectContaining({ roundId: 'r1', type: 'guess', letter: 'ş' }));
    expect(retry).toEqual(first);
    expect(other.letter).toBe('a');
    expect(other.actionId).not.toBe(first.actionId);
    expect(solve).toEqual(expect.objectContaining({ type: 'solve', word: 'kahve' }));
    expect(solve.letter).toBeUndefined();
  });

  it('returns the 409 code and refetches on a stale round', async () => {
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.engine).not.toBeNull());
    const callsBefore = mockApi.games.get.mock.calls.length;
    mockApi.games.action.mockRejectedValueOnce(
      Object.assign(new Error('Tur kapandı.'), { code: 'STALE_ROUND', status: 409 })
    );
    let outcome: LiveActionResult | undefined;
    await act(async () => {
      outcome = await result.current.submitAction({ type: 'answer', optionIndex: 2 });
    });
    expect(outcome).toEqual(expect.objectContaining({ ok: false, code: 'STALE_ROUND' }));
    await waitFor(() => expect(mockApi.games.get.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('ends on the server result exactly once and uses its transferred stake', async () => {
    mockApi.games.get.mockResolvedValue(
      buildSnapshot({
        status: 'finished',
        winner: 'alice',
        gameState: {
          engine: buildEngine({
            phase: 'finished',
            result: {
              winner: 'alice',
              scores: { host: 7, guest: 4 },
              stakeTransferred: 25,
              settled: true,
            },
          }),
        },
      })
    );
    const { result, onGameEnd } = renderLearningHook();
    await waitFor(() => expect(result.current.done).toBe(true), { timeout: 2000 });
    await waitFor(
      () =>
        expect(onGameEnd).toHaveBeenCalledWith(
          'alice',
          25,
          expect.objectContaining({ kind: 'quiz', playerScore: 7, opponentScore: 4 })
        ),
      { timeout: 2000 }
    );
    mockApi.games.get.mockClear();
    await act(async () => {
      await result.current.fetchSnapshot();
    });
    expect(onGameEnd).toHaveBeenCalledTimes(1);
  });

  it('reports an abandoned match without paying either side', async () => {
    mockApi.games.get.mockResolvedValue(
      buildSnapshot({
        status: 'finished',
        winner: null,
        gameState: {
          engine: buildEngine({
            phase: 'finished',
            result: { winner: null, cancelled: true, settled: true, scores: { host: 0, guest: 0 } },
          }),
        },
      })
    );
    const { onGameEnd } = renderLearningHook();
    await waitFor(
      () => expect(onGameEnd).toHaveBeenCalledWith('Maç iptal edildi', 0, expect.any(Object)),
      { timeout: 2000 }
    );
  });

  it('refuses an active legacy snapshot instead of falling back', async () => {
    mockApi.games.get.mockResolvedValue(buildSnapshot({ protocolVersion: 1, gameState: {} }));
    const { result, onGameEnd } = renderLearningHook();
    await waitFor(() => expect(result.current.protocolError).toBe(true));
    expect(result.current.engine).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onGameEnd).not.toHaveBeenCalled();
  });

  it('subscribes to the socket, joins the room, and cleans both up', async () => {
    const { unmount } = renderLearningHook();
    await waitFor(() => expect(mockApi.games.get).toHaveBeenCalled());
    const socket = mockSocketService.getSocket();
    expect(mockSocketService.joinGame).toHaveBeenCalledWith('game-1');
    expect(socket.on).toHaveBeenCalledWith('game_state_updated', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    unmount();
    expect(socket.off).toHaveBeenCalledWith('game_state_updated', expect.any(Function));
    expect(mockSocketService.leaveGame).toHaveBeenCalledWith('game-1');
  });

  it('reset clears a snapshot for a new match', async () => {
    const { result } = renderLearningHook();
    await waitFor(() => expect(result.current.engine).not.toBeNull());
    act(() => {
      result.current.reset();
    });
    expect(result.current.engine).toBeNull();
    expect(result.current.playerScore).toBe(0);
    expect(result.current.done).toBe(false);
  });
});
