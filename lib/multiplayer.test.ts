import { pickWinnerFromScoreboard } from './multiplayer';

describe('pickWinnerFromScoreboard', () => {
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
});
