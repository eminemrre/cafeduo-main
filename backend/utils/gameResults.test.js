const {
  getGameParticipants,
  normalizeParticipantName,
  sanitizeScoreSubmission,
  pickWinnerFromResults,
} = require('./gameResults');

describe('gameResults utilities', () => {
  it('extracts unique participants from host and guest', () => {
    expect(
      getGameParticipants({ host_name: 'HostUser', guest_name: 'GuestUser' })
    ).toEqual(['HostUser', 'GuestUser']);
    expect(
      getGameParticipants({ host_name: 'HostUser', guest_name: 'hostuser' })
    ).toEqual(['HostUser', 'hostuser']);
  });

  it('normalizes participant names case-insensitively', () => {
    const game = { host_name: 'Emre', guest_name: 'Emin' };
    expect(normalizeParticipantName('  emre ', game)).toBe('Emre');
    expect(normalizeParticipantName('EMIN', game)).toBe('Emin');
    expect(normalizeParticipantName('başkası', game)).toBeNull();
  });

  it('sanitizes score payload values', () => {
    const payload = sanitizeScoreSubmission({
      score: '12.9',
      roundsWon: -4,
      durationMs: '2500',
      submittedAt: '',
    });

    expect(payload.score).toBe(12);
    expect(payload.roundsWon).toBe(0);
    expect(payload.durationMs).toBe(2500);
    expect(new Date(payload.submittedAt).toString()).not.toBe('Invalid Date');
  });

  it('picks winner by score, rounds, duration and submitted time', () => {
    const participants = ['emre', 'emin'];

    expect(
      pickWinnerFromResults(
        {
          emre: { score: 2, roundsWon: 2, durationMs: 9000, submittedAt: '2026-02-07T10:00:00.000Z' },
          emin: { score: 3, roundsWon: 2, durationMs: 9500, submittedAt: '2026-02-07T10:00:02.000Z' },
        },
        participants
      )
    ).toBe('emin');

    expect(
      pickWinnerFromResults(
        {
          emre: { score: 3, roundsWon: 4, durationMs: 9500, submittedAt: '2026-02-07T10:00:00.000Z' },
          emin: { score: 3, roundsWon: 2, durationMs: 1000, submittedAt: '2026-02-07T10:00:01.000Z' },
        },
        participants
      )
    ).toBe('emre');

    expect(
      pickWinnerFromResults(
        {
          emre: { score: 3, roundsWon: 3, durationMs: 7000, submittedAt: '2026-02-07T10:00:02.000Z' },
          emin: { score: 3, roundsWon: 3, durationMs: 5000, submittedAt: '2026-02-07T10:00:01.000Z' },
        },
        participants
      )
    ).toBe('emin');
  });

  it('ignores non-participant scores and returns null until both participants submit', () => {
    const participants = ['host', 'guest'];

    expect(
      pickWinnerFromResults(
        {
          host: { score: 3 },
          attacker: { score: 9999 },
        },
        participants
      )
    ).toBeNull();

    expect(
      pickWinnerFromResults(
        {
          host: { score: 3 },
          guest: { score: 2 },
          attacker: { score: 9999 },
        },
        participants
      )
    ).toBe('host');
  });
});
