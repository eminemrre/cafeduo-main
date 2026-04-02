/**
 * Additional branch coverage tests for lib/multiplayer.ts
 * Targets uncovered branches: filterScoreboardToParticipants, submitScoreAndWaitForWinner edge cases
 */

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

describe('multiplayer branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pickWinnerFromScoreboard edge cases', () => {
    it('returns null for empty scoreboard', () => {
      expect(pickWinnerFromScoreboard({})).toBeNull();
    });

    it('returns null for single entry', () => {
      expect(pickWinnerFromScoreboard({ player1: { score: 5 } })).toBeNull();
    });

    it('handles entries with all undefined optional fields', () => {
      const winner = pickWinnerFromScoreboard({
        a: { score: 0 },
        b: { score: 0 },
      });
      expect(winner).toBeTruthy();
    });

    it('handles entries with null-ish values', () => {
      const winner = pickWinnerFromScoreboard({
        a: { score: null as any, roundsWon: null as any },
        b: { score: undefined as any, roundsWon: undefined as any },
      });
      expect(winner).toBeTruthy();
    });

    it('picks winner with equal scores but different roundsWon', () => {
      const winner = pickWinnerFromScoreboard({
        emin: { score: 3, roundsWon: 2 },
        rakip: { score: 3, roundsWon: 3 },
      });
      expect(winner).toBe('rakip');
    });

    it('picks winner with equal scores and roundsWon but different duration', () => {
      const winner = pickWinnerFromScoreboard({
        emin: { score: 3, roundsWon: 2, durationMs: 8000 },
        rakip: { score: 3, roundsWon: 2, durationMs: 5000 },
      });
      expect(winner).toBe('rakip');
    });

    it('picks winner with equal everything by submittedAt', () => {
      const winner = pickWinnerFromScoreboard({
        emin: { score: 3, roundsWon: 2, durationMs: 5000, submittedAt: '2026-01-01T10:00:00.000Z' },
        rakip: { score: 3, roundsWon: 2, durationMs: 5000, submittedAt: '2026-01-01T10:00:01.000Z' },
      });
      expect(winner).toBe('emin');
    });
  });

  describe('submitScoreAndWaitForWinner edge cases', () => {
    it('handles game with no gameState object', async () => {
      (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
      (api.games.get as jest.Mock).mockResolvedValue({
        status: 'active',
      });

      const result = await submitScoreAndWaitForWinner({
        gameId: 1,
        username: 'emin',
        score: 5,
        timeoutMs: 10,
        pollIntervalMs: 0,
      });

      expect(result.timedOut).toBe(true);
    });

    it('handles game with gameState.resolvedWinner and triggers finish', async () => {
      (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
      (api.games.finish as jest.Mock).mockResolvedValue({ success: true });
      (api.games.get as jest.Mock)
        .mockResolvedValueOnce({
          status: 'active',
          hostName: 'emin',
          guestName: 'rakip',
          gameState: {
            resolvedWinner: 'emin',
            results: { emin: { score: 5 }, rakip: { score: 3 } },
          },
        })
        .mockResolvedValueOnce({
          status: 'finished',
          winner: 'emin',
          gameState: {
            results: { emin: { score: 5 }, rakip: { score: 3 } },
          },
        });

      const result = await submitScoreAndWaitForWinner({
        gameId: 1,
        username: 'emin',
        score: 5,
        timeoutMs: 200,
        pollIntervalMs: 0,
      });

      expect(result.winner).toBe('emin');
      expect(result.finished).toBe(true);
    });

    it('handles empty participants list', async () => {
      (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
      (api.games.get as jest.Mock).mockResolvedValue({
        status: 'active',
        hostName: '',
        guestName: '',
        gameState: {
          results: { emin: { score: 5 } },
        },
      });

      const result = await submitScoreAndWaitForWinner({
        gameId: 1,
        username: 'emin',
        score: 5,
        timeoutMs: 10,
        pollIntervalMs: 0,
      });

      expect(result.timedOut).toBe(true);
    });

    it('handles finish call failure gracefully', async () => {
      (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
      (api.games.finish as jest.Mock).mockRejectedValue(new Error('Already finished'));
      (api.games.get as jest.Mock)
        .mockResolvedValueOnce({
          status: 'active',
          hostName: 'emin',
          guestName: 'rakip',
          gameState: {
            resolvedWinner: 'emin',
            results: { emin: { score: 5 }, rakip: { score: 3 } },
          },
        })
        .mockResolvedValueOnce({
          status: 'finished',
          winner: 'emin',
          gameState: {
            results: { emin: { score: 5 }, rakip: { score: 3 } },
          },
        });

      const result = await submitScoreAndWaitForWinner({
        gameId: 1,
        username: 'emin',
        score: 5,
        timeoutMs: 200,
        pollIntervalMs: 0,
      });

      // Should still succeed despite finish error
      expect(result.winner).toBe('emin');
      expect(result.finished).toBe(true);
    });

    it('handles gameState.live.resolvedWinner path', async () => {
      (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
      (api.games.get as jest.Mock).mockResolvedValue({
        status: 'finished',
        gameState: {
          live: {
            resolvedWinner: 'rakip',
          },
          results: { emin: { score: 3 }, rakip: { score: 5 } },
        },
      });

      const result = await submitScoreAndWaitForWinner({
        gameId: 1,
        username: 'emin',
        score: 3,
        timeoutMs: 100,
        pollIntervalMs: 0,
      });

      expect(result.winner).toBe('rakip');
      expect(result.finished).toBe(true);
    });

    it('handles non-object results gracefully', async () => {
      (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
      (api.games.get as jest.Mock).mockResolvedValue({
        status: 'active',
        hostName: 'emin',
        guestName: 'rakip',
        gameState: {
          results: 'not-an-object',
        },
      });

      const result = await submitScoreAndWaitForWinner({
        gameId: 1,
        username: 'emin',
        score: 5,
        timeoutMs: 10,
        pollIntervalMs: 0,
      });

      expect(result.timedOut).toBe(true);
      expect(result.scoreboard).toEqual({});
    });

    it('handles array results gracefully', async () => {
      (api.games.submitScore as jest.Mock).mockResolvedValue(undefined);
      (api.games.get as jest.Mock).mockResolvedValue({
        status: 'active',
        hostName: 'emin',
        guestName: 'rakip',
        gameState: {
          results: [{ score: 5 }],
        },
      });

      const result = await submitScoreAndWaitForWinner({
        gameId: 1,
        username: 'emin',
        score: 5,
        timeoutMs: 10,
        pollIntervalMs: 0,
      });

      expect(result.timedOut).toBe(true);
      expect(result.scoreboard).toEqual({});
    });
  });
});
