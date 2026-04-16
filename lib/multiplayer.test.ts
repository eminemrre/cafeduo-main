import { pickWinnerFromScoreboard, submitScoreAndWaitForWinner } from './multiplayer';
import { api } from './api';

jest.mock('./api', () => ({
  api: {
    games: {
      submitScore: jest.fn(),
      get: jest.fn(),
      finish: jest.fn(),
    },
  },
}));

describe('pickWinnerFromScoreboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when less than 2 scores exist', () => {
    expect(pickWinnerFromScoreboard({})).toBeNull();
    expect(
      pickWinnerFromScoreboard({
        emin: { score: 3 },
      })
    ).toBeNull();
  });

  it('picks highest score as winner', () => {
    const winner = pickWinnerFromScoreboard({
      emin: { score: 4, submittedAt: '2026-02-06T10:00:00.000Z' },
      rakip: { score: 2, submittedAt: '2026-02-06T10:00:01.000Z' },
    });

    expect(winner).toBe('emin');
  });

  it('uses duration as tie-breaker when scores are equal', () => {
    const winner = pickWinnerFromScoreboard({
      emin: { score: 3, durationMs: 5300, submittedAt: '2026-02-06T10:00:01.000Z' },
      rakip: { score: 3, durationMs: 4800, submittedAt: '2026-02-06T10:00:02.000Z' },
    });

    expect(winner).toBe('rakip');
  });

  it('uses roundsWon tie-breaker before duration', () => {
    const winner = pickWinnerFromScoreboard({
      emin: { score: 4, roundsWon: 2, durationMs: 3000, submittedAt: '2026-02-06T10:00:01.000Z' },
      rakip: { score: 4, roundsWon: 3, durationMs: 6000, submittedAt: '2026-02-06T10:00:02.000Z' },
    });

    expect(winner).toBe('rakip');
  });

  it('uses earliest submit timestamp as final tie-breaker', () => {
    const winner = pickWinnerFromScoreboard({
      emin: { score: 2, roundsWon: 1, durationMs: 4000, submittedAt: '2026-02-06T10:00:00.000Z' },
      rakip: { score: 2, roundsWon: 1, durationMs: 4000, submittedAt: '2026-02-06T10:00:01.000Z' },
    });

    expect(winner).toBe('emin');
  });

  it('treats invalid numbers defensively', () => {
    const winner = pickWinnerFromScoreboard({
      emin: { score: Number.NaN, roundsWon: undefined, durationMs: undefined },
      rakip: { score: 1, roundsWon: 0, durationMs: 0 },
    });

    expect(winner).toBe('rakip');
  });
});

describe('submitScoreAndWaitForWinner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits score and returns winner when scoreboard is ready', async () => {
    (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
    (api.games.finish as jest.Mock).mockResolvedValue({ success: true });
    (api.games.get as jest.Mock).mockResolvedValue({
      status: 'finished',
      winner: 'emin',
      gameState: {
        results: {
          emin: { score: 9, roundsWon: 3, durationMs: 12000 },
          rakip: { score: 6, roundsWon: 2, durationMs: 13000 },
        },
      },
    });

    const result = await submitScoreAndWaitForWinner({
      gameId: 7,
      username: 'emin',
      score: 9,
      roundsWon: 3,
      durationMs: 12000,
      timeoutMs: 100,
      pollIntervalMs: 0,
    });

    expect(api.games.submitScore).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        username: 'emin',
        score: 9,
        roundsWon: 3,
        durationMs: 12000,
        submissionKey: expect.any(String),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        winner: 'emin',
        timedOut: false,
        finished: true,
      })
    );
  });

  it('continues polling after transient fetch error and eventually finds winner', async () => {
    (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
    (api.games.finish as jest.Mock).mockResolvedValue({ success: true });
    (api.games.get as jest.Mock)
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({
        status: 'active',
        gameState: {
          resolvedWinner: 'rakip',
          results: {
            emin: { score: 4 },
            rakip: { score: 5 },
          },
        },
      })
      .mockResolvedValueOnce({
        status: 'finished',
        winner: 'rakip',
        gameState: {
          results: {
            emin: { score: 4 },
            rakip: { score: 5 },
          },
        },
      });

    const result = await submitScoreAndWaitForWinner({
      gameId: 'g-11',
      username: 'emin',
      score: 4,
      timeoutMs: 200,
      pollIntervalMs: 0,
    });

    expect(api.games.get).toHaveBeenCalledTimes(3);
    expect(api.games.finish).toHaveBeenCalledWith('g-11');
    expect(result.winner).toBe('rakip');
    expect(result.timedOut).toBe(false);
    expect(result.finished).toBe(true);
  });

  it('times out when a complete scoreboard never arrives', async () => {
    (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
    (api.games.get as jest.Mock).mockResolvedValue({
      gameState: {
        results: {
          emin: { score: 2 },
        },
      },
    });

    const result = await submitScoreAndWaitForWinner({
      gameId: 99,
      username: 'emin',
      score: 2,
      timeoutMs: 10,
      pollIntervalMs: 0,
    });

    expect(result.timedOut).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.finished).toBe(false);
    expect(result.scoreboard).toEqual({
      emin: { score: 2 },
    });
  });

  it('ignores non-participant submissions while waiting for winner', async () => {
    (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
    (api.games.get as jest.Mock).mockResolvedValue({
      hostName: 'emin',
      guestName: 'rakip',
      gameState: {
        results: {
          emin: { score: 4 },
          attacker: { score: 9999 },
        },
      },
    });

    const result = await submitScoreAndWaitForWinner({
      gameId: 81,
      username: 'emin',
      score: 4,
      timeoutMs: 10,
      pollIntervalMs: 0,
    });

    expect(result.timedOut).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.finished).toBe(false);
    expect(result.scoreboard).toEqual({
      emin: { score: 4 },
    });
  });
});
