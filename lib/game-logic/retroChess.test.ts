import { Chess } from 'chess.js';
import {
  FILES,
  RANKS,
  buildClockState,
  deriveDisplayClock,
  deriveOpponentLabel,
  derivePlayerColor,
  extractLastMove,
  formatClock,
  inferResultLabel,
  loadChess,
  normalizeDrawOfferState,
  normalizeWinner,
  parseRetryAfterMs,
  shouldPollSnapshot,
  toSquare,
} from './retroChess';

describe('retroChess helpers', () => {
  test('board helpers stay stable', () => {
    expect(FILES).toHaveLength(8);
    expect(RANKS[0]).toBe('8');
    expect(toSquare('e', '4')).toBe('e4');
  });

  test('normalizeWinner and loadChess handle invalid inputs', () => {
    expect(normalizeWinner('  Emin ')).toBe('Emin');
    expect(normalizeWinner('')).toBeNull();
    expect(loadChess('invalid fen').fen()).toBe(new Chess().fen());
  });

  test('inferResultLabel distinguishes mate and draw states', () => {
    const mate = new Chess();
    mate.loadPgn('1. f3 e5 2. g4 Qh4#');
    expect(inferResultLabel(mate)).toBe('Şah mat');

    const draw = new Chess('7k/5Q2/7K/8/8/8/8/8 b - - 0 1');
    expect(inferResultLabel(draw)).toBe('Pat');
  });

  test('clock helpers normalize and display countdowns', () => {
    expect(formatClock(61_000)).toBe('01:01');
    const clock = buildClockState({ whiteMs: 60_000, blackMs: 45_000, incrementMs: 2_000, label: '1+2', lastTickAt: '2026-03-07T10:00:00.000Z' });
    expect(clock).toEqual({
      whiteMs: 60_000,
      blackMs: 45_000,
      incrementMs: 2_000,
      label: '1+2',
      lastTickAt: '2026-03-07T10:00:00.000Z',
    });
    expect(deriveDisplayClock({ clockState: clock!, serverStatus: 'active', turn: 'w', nowMs: Date.parse('2026-03-07T10:00:05.000Z') })).toEqual({ white: 55_000, black: 45_000 });
    expect(deriveDisplayClock({ clockState: clock!, serverStatus: 'finished', turn: 'b', nowMs: Date.parse('2026-03-07T10:00:05.000Z') })).toEqual({ white: 60_000, black: 45_000 });
  });

  test('draw offer and retry helpers sanitize payloads', () => {
    expect(parseRetryAfterMs('Lütfen 12 sn bekle')).toBe(12_000);
    expect(parseRetryAfterMs('no retry')).toBe(0);
    expect(normalizeDrawOfferState({ status: 'PENDING', offeredBy: 'emin', createdAt: '2026-03-07T10:00:00.000Z' })).toEqual({
      status: 'pending',
      offeredBy: 'emin',
      createdAt: '2026-03-07T10:00:00.000Z',
      respondedBy: undefined,
      respondedAt: undefined,
    });
    expect(normalizeDrawOfferState({ status: 'weird', offeredBy: 'emin' })).toBeNull();
  });

  test('player color and opponent label derive from actor role', () => {
    expect(derivePlayerColor({ isBot: true, currentUsername: 'emin' })).toBe('w');
    expect(derivePlayerColor({ isBot: false, currentUsername: 'emin', hostName: 'Emin', guestName: 'rakip' })).toBe('w');
    expect(derivePlayerColor({ isBot: false, currentUsername: 'emin', hostName: 'host', guestName: 'Emin' })).toBe('b');
    expect(deriveOpponentLabel({ isBot: false, playerColor: 'w', guestName: 'rakip', opponentName: 'fallback' })).toBe('rakip');
    expect(deriveOpponentLabel({ isBot: false, playerColor: 'b', hostName: 'host' })).toBe('host');
    expect(deriveOpponentLabel({ isBot: true, playerColor: 'w' })).toBe('BOT');
  });

  test('extractLastMove and polling guard cover branch logic', () => {
    expect(extractLastMove([{ from: 'e2', to: 'e4' }])).toEqual({ from: 'e2', to: 'e4' });
    expect(extractLastMove([])).toBeNull();

    expect(shouldPollSnapshot({
      isBot: false,
      hasGameId: true,
      serverStatus: 'active',
      pollPauseUntil: 0,
      lastRealtimeAt: 0,
      visibilityState: 'visible',
      nowMs: 20_000,
    })).toBe(true);
    expect(shouldPollSnapshot({
      isBot: false,
      hasGameId: true,
      serverStatus: 'active',
      pollPauseUntil: 25_000,
      lastRealtimeAt: 0,
      visibilityState: 'visible',
      nowMs: 20_000,
    })).toBe(false);
    expect(shouldPollSnapshot({
      isBot: false,
      hasGameId: true,
      serverStatus: 'active',
      pollPauseUntil: 0,
      lastRealtimeAt: 10_000,
      visibilityState: 'visible',
      nowMs: 20_000,
    })).toBe(false);
  });
});
