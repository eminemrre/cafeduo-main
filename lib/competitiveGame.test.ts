import {
  actorKeyFor,
  createActionId,
  engineOf,
  isCompetitiveGameType,
  isProtocolV2,
  opponentNameFor,
  resignCompetitiveGame,
  secondsLeftAt,
  serverClockOffset,
} from './competitiveGame';
import { api } from './api';
import type { CompetitiveEngineState, CompetitiveGame } from '../types';

jest.mock('./api', () => ({
  api: {
    games: {
      get: jest.fn(),
      action: jest.fn(),
    },
  },
}));

const mockApi = api as unknown as {
  games: { get: jest.Mock; action: jest.Mock };
};

const buildEngine = (overrides: Partial<CompetitiveEngineState> = {}): CompetitiveEngineState => ({
  version: 2,
  kind: 'aim',
  revision: 1,
  phase: 'open',
  roundIndex: 1,
  totalRounds: 5,
  startedAt: '2026-10-21T12:00:00.000Z',
  phaseEndsAt: '2026-10-21T12:00:08.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
  players: {
    host: { name: 'emin', score: 0 },
    guest: { name: 'bob', score: 0 },
  },
  round: {
    id: 'r1',
    index: 1,
    startedAt: '2026-10-21T12:00:00.000Z',
    endsAt: '2026-10-21T12:00:08.000Z',
  },
  result: null,
  ...overrides,
});

const buildSnapshot = (overrides: Partial<CompetitiveGame> = {}): CompetitiveGame => ({
  id: 7,
  hostName: 'emin',
  guestName: 'bob',
  gameType: 'Nişancı Düellosu',
  points: 10,
  table: 'MASA01',
  status: 'active',
  protocolVersion: 2,
  serverNow: '2026-10-21T12:00:02.000Z',
  gameState: { engine: buildEngine() },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('competitive game helpers', () => {
  it('recognizes only the two ranked game types', () => {
    expect(isCompetitiveGameType('Bilgi Yarışı')).toBe(true);
    expect(isCompetitiveGameType('Nişancı Düellosu')).toBe(true);
    expect(isCompetitiveGameType('Retro Satranç')).toBe(false);
    expect(isCompetitiveGameType('')).toBe(false);
  });

  it('resolves the actor case-insensitively and never guesses a non-player', () => {
    const snapshot = buildSnapshot({ hostName: 'Emin', guestName: 'BOB' });
    expect(actorKeyFor(snapshot, 'emin')).toBe('host');
    expect(actorKeyFor(snapshot, 'bob')).toBe('guest');
    expect(actorKeyFor(snapshot, 'carol')).toBeNull();
    expect(opponentNameFor(snapshot, 'guest')).toBe('Emin');
  });

  it('requires protocol version 2 and an engine version 2 for v2 play', () => {
    expect(isProtocolV2(buildSnapshot())).toBe(true);
    expect(isProtocolV2(buildSnapshot({ protocolVersion: 1 }))).toBe(false);
    expect(
      isProtocolV2(
        buildSnapshot({
          gameState: {
            engine: buildEngine({ version: 1 } as unknown as Partial<CompetitiveEngineState>),
          },
        })
      )
    ).toBe(false);
    expect(isProtocolV2(buildSnapshot({ gameState: {} }))).toBe(false);
  });

  it('reads the engine only from the public snapshot', () => {
    expect(engineOf(buildSnapshot())?.round?.id).toBe('r1');
    expect(engineOf(null)).toBeNull();
  });

  it('estimates the server clock offset and floors the countdown at zero', () => {
    expect(serverClockOffset(buildSnapshot(), Date.parse('2026-10-21T12:00:00.000Z'))).toBe(2000);
    expect(serverClockOffset(buildSnapshot({ serverNow: undefined }))).toBe(0);
    expect(secondsLeftAt('2026-10-21T12:00:08.000Z', Date.parse('2026-10-21T12:00:00.000Z'))).toBe(
      8
    );
    expect(secondsLeftAt('2026-10-21T12:00:08.000Z', Date.parse('2026-10-21T12:00:09.000Z'))).toBe(
      0
    );
  });

  it('creates a short, prefixed action id', () => {
    const id = createActionId('answer');
    expect(id.startsWith('answer-')).toBe(true);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(createActionId('answer')).not.toBe(id);
  });
});

describe('resignCompetitiveGame', () => {
  it('sends a resign action for the current round and reads no client result', async () => {
    mockApi.games.get.mockResolvedValue(buildSnapshot());
    mockApi.games.action.mockResolvedValue({ success: true });

    await resignCompetitiveGame(7);

    expect(mockApi.games.action).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ roundId: 'r1', type: 'resign', actionId: expect.any(String) })
    );
    const payload = mockApi.games.action.mock.calls[0][1];
    expect(payload.winner).toBeUndefined();
    expect(payload.score).toBeUndefined();
  });

  it('retries a stale round once with the new round id', async () => {
    mockApi.games.get.mockResolvedValueOnce(buildSnapshot()).mockResolvedValueOnce(
      buildSnapshot({
        gameState: {
          engine: buildEngine({
            roundIndex: 2,
            round: {
              id: 'r2',
              index: 2,
              startedAt: '2026-10-21T12:00:08.000Z',
              endsAt: '2026-10-21T12:00:16.000Z',
            },
          }),
        },
      })
    );
    mockApi.games.action
      .mockRejectedValueOnce(
        Object.assign(new Error('Tur kapandı.'), { code: 'STALE_ROUND', status: 409 })
      )
      .mockResolvedValueOnce({ success: true });

    await resignCompetitiveGame(7);

    expect(mockApi.games.action).toHaveBeenCalledTimes(2);
    expect(mockApi.games.action.mock.calls[0][1]).toEqual(
      expect.objectContaining({ roundId: 'r1', type: 'resign' })
    );
    expect(mockApi.games.action.mock.calls[1][1]).toEqual(
      expect.objectContaining({ roundId: 'r2', type: 'resign' })
    );
    expect(mockApi.games.action.mock.calls[0][1].actionId).not.toBe(
      mockApi.games.action.mock.calls[1][1].actionId
    );
  });

  it('does nothing when the game already finished', async () => {
    mockApi.games.get.mockResolvedValue(
      buildSnapshot({
        status: 'finished',
        gameState: { engine: buildEngine({ phase: 'finished' }) },
      })
    );

    await resignCompetitiveGame(7);

    expect(mockApi.games.action).not.toHaveBeenCalled();
  });

  it('does not retry a non-retryable action failure', async () => {
    mockApi.games.get.mockResolvedValue(buildSnapshot());
    mockApi.games.action.mockRejectedValue(
      Object.assign(new Error('Bu oyunun oyuncusu değilsin.'), { code: 'FORBIDDEN', status: 403 })
    );

    await expect(resignCompetitiveGame(7)).rejects.toThrow('Bu oyunun oyuncusu değilsin.');
    expect(mockApi.games.action).toHaveBeenCalledTimes(1);
  });
});
