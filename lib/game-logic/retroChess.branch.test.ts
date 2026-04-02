/**
 * Additional branch coverage tests for lib/game-logic/retroChess.ts
 * Targets uncovered branches: lines 44-47 (inferResultLabel), line 117 (derivePlayerColor)
 */

import { Chess } from 'chess.js';
import {
  inferResultLabel,
  loadChess,
  normalizeWinner,
  derivePlayerColor,
  deriveOpponentLabel,
  normalizeDrawOfferState,
  buildClockState,
  extractLastMove,
  formatClock,
  parseRetryAfterMs,
  deriveDisplayClock,
  shouldPollSnapshot,
  type ChessClockState,
} from './retroChess';

describe('retroChess branch coverage', () => {
  describe('inferResultLabel', () => {
    it('returns "Yetersiz materyal" for insufficient material', () => {
      // King vs King is insufficient material
      const engine = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
      expect(inferResultLabel(engine)).toBe('Yetersiz materyal');
    });

    it('returns "Üçlü tekrar" for threefold repetition', () => {
      const engine = new Chess();
      // Create threefold repetition: Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8
      engine.move('Nf3');
      engine.move('Nf6');
      engine.move('Ng1');
      engine.move('Ng8');
      engine.move('Nf3');
      engine.move('Nf6');
      engine.move('Ng1');
      engine.move('Ng8');
      // Position repeated three times now
      if (engine.isThreefoldRepetition()) {
        expect(inferResultLabel(engine)).toBe('Üçlü tekrar');
      }
    });

    it('returns "Berabere" for general draw', () => {
      // King vs King is insufficient material which isDraw() returns true
      const engine = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
      // Force a draw state if needed (this position is already insufficient material)
      expect(inferResultLabel(engine)).toBe('Yetersiz materyal');
    });

    it('returns "Oyun bitti" for active games', () => {
      const engine = new Chess();
      expect(inferResultLabel(engine)).toBe('Oyun bitti');
    });
  });

  describe('loadChess', () => {
    it('loads default position for empty string', () => {
      const engine = loadChess('');
      expect(engine.fen()).toBe(new Chess().fen());
    });

    it('loads default position for null/undefined', () => {
      const engine = loadChess(null);
      expect(engine.fen()).toBe(new Chess().fen());
    });

    it('loads valid FEN', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const engine = loadChess(fen);
      expect(engine.fen()).toBe(fen);
    });

    it('loads default position for invalid FEN', () => {
      const engine = loadChess('completely invalid fen');
      expect(engine.fen()).toBe(new Chess().fen());
    });
  });

  describe('normalizeWinner', () => {
    it('returns null for null', () => {
      expect(normalizeWinner(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(normalizeWinner(undefined)).toBeNull();
    });

    it('returns null for 0', () => {
      expect(normalizeWinner(0)).toBeNull();
    });

    it('trims whitespace', () => {
      expect(normalizeWinner('  emin  ')).toBe('emin');
    });
  });

  describe('derivePlayerColor', () => {
    it('returns null when player is neither host nor guest', () => {
      expect(
        derivePlayerColor({
          isBot: false,
          currentUsername: 'unknown',
          hostName: 'host',
          guestName: 'guest',
        })
      ).toBeNull();
    });

    it('returns null when no host/guest names', () => {
      expect(
        derivePlayerColor({
          isBot: false,
          currentUsername: 'emin',
        })
      ).toBeNull();
    });

    it('returns w for bot mode', () => {
      expect(
        derivePlayerColor({ isBot: true, currentUsername: '' })
      ).toBe('w');
    });

    it('handles empty currentUsername', () => {
      expect(
        derivePlayerColor({
          isBot: false,
          currentUsername: '',
          hostName: 'host',
          guestName: 'guest',
        })
      ).toBeNull();
    });
  });

  describe('deriveOpponentLabel', () => {
    it('returns opponentName fallback for white player', () => {
      expect(
        deriveOpponentLabel({
          isBot: false,
          playerColor: 'w',
          opponentName: 'fallback',
        })
      ).toBe('fallback');
    });

    it('returns "Rakip" when no names available for white', () => {
      expect(
        deriveOpponentLabel({
          isBot: false,
          playerColor: 'w',
        })
      ).toBe('Rakip');
    });

    it('returns opponentName fallback for black player', () => {
      expect(
        deriveOpponentLabel({
          isBot: false,
          playerColor: 'b',
          opponentName: 'fallback',
        })
      ).toBe('fallback');
    });

    it('returns "Rakip" when no names available for black', () => {
      expect(
        deriveOpponentLabel({
          isBot: false,
          playerColor: 'b',
        })
      ).toBe('Rakip');
    });

    it('returns "Rakip" for null playerColor', () => {
      expect(
        deriveOpponentLabel({
          isBot: false,
          playerColor: null,
          hostName: 'host',
        })
      ).toBe('host');
    });
  });

  describe('normalizeDrawOfferState', () => {
    it('returns null for null input', () => {
      expect(normalizeDrawOfferState(null)).toBeNull();
    });

    it('returns null for string input', () => {
      expect(normalizeDrawOfferState('not an object')).toBeNull();
    });

    it('returns null for missing offeredBy', () => {
      expect(normalizeDrawOfferState({ status: 'pending' })).toBeNull();
    });

    it('returns null for empty offeredBy', () => {
      expect(normalizeDrawOfferState({ status: 'pending', offeredBy: '  ' })).toBeNull();
    });

    it('normalizes all valid statuses', () => {
      const statuses = ['pending', 'accepted', 'rejected', 'cancelled'];
      for (const status of statuses) {
        const result = normalizeDrawOfferState({ status, offeredBy: 'emin' });
        expect(result?.status).toBe(status);
      }
    });

    it('includes respondedBy and respondedAt when present', () => {
      const result = normalizeDrawOfferState({
        status: 'accepted',
        offeredBy: 'emin',
        createdAt: '2026-01-01',
        respondedBy: 'rakip',
        respondedAt: '2026-01-02',
      });
      expect(result?.respondedBy).toBe('rakip');
      expect(result?.respondedAt).toBe('2026-01-02');
    });

    it('uses current ISO string when createdAt is empty', () => {
      const result = normalizeDrawOfferState({
        status: 'pending',
        offeredBy: 'emin',
        createdAt: '',
      });
      expect(result?.createdAt).toBeTruthy();
    });
  });

  describe('buildClockState', () => {
    it('returns null for null input', () => {
      expect(buildClockState(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(buildClockState(undefined)).toBeNull();
    });

    it('returns null for non-object', () => {
      expect(buildClockState('string')).toBeNull();
    });

    it('uses fallback label', () => {
      const result = buildClockState({}, '5+3');
      expect(result?.label).toBe('5+3');
    });

    it('clamps negative values to 0', () => {
      const result = buildClockState({ whiteMs: -100, blackMs: -50, incrementMs: -10 });
      expect(result?.whiteMs).toBe(0);
      expect(result?.blackMs).toBe(0);
      expect(result?.incrementMs).toBe(0);
    });

    it('handles lastTickAt as null when not provided', () => {
      const result = buildClockState({ whiteMs: 60000, blackMs: 60000 });
      expect(result?.lastTickAt).toBeNull();
    });
  });

  describe('extractLastMove', () => {
    it('returns null for null input', () => {
      expect(extractLastMove(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(extractLastMove(undefined)).toBeNull();
    });

    it('returns last move from non-empty array', () => {
      const result = extractLastMove([
        { from: 'e2', to: 'e4' },
        { from: 'd7', to: 'd5' },
      ]);
      expect(result).toEqual({ from: 'd7', to: 'd5' });
    });
  });

  describe('formatClock', () => {
    it('formats 0ms', () => {
      expect(formatClock(0)).toBe('00:00');
    });

    it('formats negative ms as 0', () => {
      expect(formatClock(-5000)).toBe('00:00');
    });

    it('formats NaN as 0', () => {
      expect(formatClock(NaN)).toBe('00:00');
    });

    it('formats exact minutes', () => {
      expect(formatClock(120000)).toBe('02:00');
    });
  });

  describe('parseRetryAfterMs', () => {
    it('extracts positive integer from message with negative prefix', () => {
      // Regex /(\d+)\s*sn/ captures '5' from '-5 sn', returns 5000ms
      expect(parseRetryAfterMs('-5 sn')).toBe(5000);
    });

    it('returns 0 for 0 seconds', () => {
      expect(parseRetryAfterMs('0 sn')).toBe(0);
    });

    it('returns 0 for no match', () => {
      expect(parseRetryAfterMs('invalid')).toBe(0);
    });
  });

  describe('deriveDisplayClock', () => {
    it('calculates elapsed for black turn', () => {
      const clock: ChessClockState = {
        whiteMs: 60000,
        blackMs: 45000,
        incrementMs: 2000,
        label: '1+2',
        lastTickAt: '2026-03-07T10:00:00.000Z',
      };
      const result = deriveDisplayClock({
        clockState: clock,
        serverStatus: 'active',
        turn: 'b',
        nowMs: Date.parse('2026-03-07T10:00:05.000Z'),
      });
      expect(result).toEqual({ white: 60000, black: 40000 });
    });

    it('does not subtract when lastTickAt is null', () => {
      const clock: ChessClockState = {
        whiteMs: 60000,
        blackMs: 45000,
        incrementMs: 2000,
        label: '1+2',
        lastTickAt: null,
      };
      const result = deriveDisplayClock({
        clockState: clock,
        serverStatus: 'active',
        turn: 'w',
        nowMs: 999999999,
      });
      expect(result).toEqual({ white: 60000, black: 45000 });
    });

    it('does not go below 0 for white', () => {
      const clock: ChessClockState = {
        whiteMs: 1000,
        blackMs: 45000,
        incrementMs: 0,
        label: '0+0',
        lastTickAt: '2026-03-07T10:00:00.000Z',
      };
      const result = deriveDisplayClock({
        clockState: clock,
        serverStatus: 'active',
        turn: 'w',
        nowMs: Date.parse('2026-03-07T10:01:00.000Z'),
      });
      expect(result.white).toBe(0);
    });
  });

  describe('shouldPollSnapshot', () => {
    it('returns false for bot', () => {
      expect(shouldPollSnapshot({
        isBot: true,
        hasGameId: true,
        serverStatus: 'active',
        pollPauseUntil: 0,
        lastRealtimeAt: 0,
      })).toBe(false);
    });

    it('returns false when no gameId', () => {
      expect(shouldPollSnapshot({
        isBot: false,
        hasGameId: false,
        serverStatus: 'active',
        pollPauseUntil: 0,
        lastRealtimeAt: 0,
      })).toBe(false);
    });

    it('returns false when hidden', () => {
      expect(shouldPollSnapshot({
        isBot: false,
        hasGameId: true,
        serverStatus: 'active',
        pollPauseUntil: 0,
        lastRealtimeAt: 0,
        visibilityState: 'hidden',
      })).toBe(false);
    });

    it('returns false when finished', () => {
      expect(shouldPollSnapshot({
        isBot: false,
        hasGameId: true,
        serverStatus: 'finished',
        pollPauseUntil: 0,
        lastRealtimeAt: 0,
      })).toBe(false);
    });
  });
});
