const {
  AIM_REVEAL_MS,
  AIM_ROUND_COUNT,
  AIM_ROUND_MS,
  advanceAim,
  applyAimAction,
  createAimPrivateState,
  createAimPublicState,
  startAimState,
} = require('./aimEngine');

const trajectory = { start: 50, direction: 1, speed: 0.1 };

const makePrivate = () => ({
  version: 2,
  kind: 'aim',
  rounds: new Array(AIM_ROUND_COUNT).fill(null).map(() => ({ trajectory: { ...trajectory } })),
  shots: {},
  actions: { host: {}, guest: {} },
});

const makeGame = (nowMs = 0) => {
  const privateState = makePrivate();
  const state = startAimState({
    state: createAimPublicState({ hostName: 'Alice', guestName: 'Bob', totalRounds: 5 }),
    privateState,
    hostName: 'Alice',
    guestName: 'Bob',
    nowMs,
  });
  return { state, privateState };
};

const fire = (roundId, actorKey, nowMs, state, privateState, extra = {}) =>
  applyAimAction({
    state,
    privateState,
    actorKey,
    envelope: {
      actionId: `act_${actorKey}_${nowMs}`,
      roundId,
      type: 'fire',
      ...extra,
    },
    nowMs,
  });

describe('aimEngine', () => {
  it('seeds five trajectories without exposing them in public state', () => {
    const privateState = createAimPrivateState({ randomInt: () => 0 });
    expect(privateState.rounds).toHaveLength(5);
    expect(privateState.rounds[0].trajectory).toEqual({
      start: 15,
      direction: 1,
      speed: 0.08695652173913043,
      rhythm: [
        { amplitude: 0.2, periodMs: 900, phase: 0 },
        { amplitude: 0.1, periodMs: 380, phase: 0 },
      ],
    });
    expect(privateState.shots).toEqual({});

    const { state } = makeGame();
    expect(state.phase).toBe('open');
    expect(state.round.trajectory).toEqual(trajectory);
    expect(state.round.shots).toBeUndefined();
    expect(state.round.endsAt).toBe(new Date(AIM_ROUND_MS).toISOString());
  });

  it('scores from the server position at receive time, ignoring client fields', () => {
    const { state, privateState } = makeGame();
    const host = fire('r1', 'host', 0, state, privateState, {
      position: 12,
      points: 0,
      gauge: 12,
      hitTier: 'miss',
    });
    expect(host.ok).toBe(true);
    expect(host.state.phase).toBe('open');
    expect(host.privateState.shots.r1.host).toMatchObject({ position: 50, points: 3 });
    expect(host.state.players.host.score).toBe(0);

    const guest = fire('r1', 'guest', 100, host.state, host.privateState);
    expect(guest.state.phase).toBe('reveal');
    expect(guest.privateState.shots.r1.guest).toMatchObject({ position: 60, points: 1 });
    expect(guest.state.players.host.score).toBe(3);
    expect(guest.state.players.guest.score).toBe(1);
    expect(guest.state.players.host.hits).toBe(1);
    expect(guest.state.round.shots).toEqual({
      host: { position: 50, points: 3 },
      guest: { position: 60, points: 1 },
    });
    expect(guest.state.round.scoreDelta).toEqual({ host: 3, guest: 1 });
    expect(guest.state.phaseEndsAt).toBe(new Date(100 + AIM_REVEAL_MS).toISOString());
  });

  it('derives 50/150/300 ms RTT scores from the server receive position', () => {
    const cases = [
      [0, 50, 3],
      [20, 52, 3],
      [50, 55, 2],
      [100, 60, 1],
      [150, 65, 0],
      [300, 80, 0],
    ];
    for (const [delayMs, expectedPosition, expectedPoints] of cases) {
      const { state, privateState } = makeGame();
      const result = fire('r1', 'host', delayMs, state, privateState, {
        position: 12,
        points: 3,
        gauge: 50,
        hitTier: 'perfect',
        clientTimestamp: Date.now() + 999_999,
      });
      expect(result.ok).toBe(true);
      expect(result.privateState.shots.r1.host).toMatchObject({
        position: expectedPosition,
        points: expectedPoints,
      });
      expect(result.state.players.host.score).toBe(0);
    }
  });

  it('publishes the seeded rhythm and scores with the same varying speed', () => {
    const { positionAt, pointsAt } = require('../../shared/aimTrajectory');
    const rhythm = [
      { amplitude: 0.3, periodMs: 1200, phase: 1 },
      { amplitude: 0.2, periodMs: 500, phase: 0.25 },
    ];
    const rhythmic = { start: 30, direction: 1, speed: 0.087, rhythm };
    const privateState = {
      ...makePrivate(),
      rounds: new Array(AIM_ROUND_COUNT).fill(null).map(() => ({ trajectory: { ...rhythmic } })),
    };
    const state = startAimState({
      state: createAimPublicState({ hostName: 'Alice', guestName: 'Bob', totalRounds: 5 }),
      privateState,
      hostName: 'Alice',
      guestName: 'Bob',
      nowMs: 0,
    });
    expect(state.round.trajectory).toEqual(rhythmic);
    const result = fire('r1', 'host', 333, state, privateState);
    expect(result.ok).toBe(true);
    expect(result.privateState.shots.r1.host.position).toBeCloseTo(positionAt(rhythmic, 333), 10);
    expect(result.privateState.shots.r1.host.points).toBe(pointsAt(rhythmic, 333));
    expect(positionAt(rhythmic, 333)).not.toBeCloseTo(
      positionAt({ ...rhythmic, rhythm: [] }, 333),
      0
    );
  });

  it('opens the next round after the reveal and finishes a 15-15 draw', () => {
    let { state, privateState } = makeGame();
    let fireAt = 0;
    for (let round = 1; round <= 5; round += 1) {
      const host = fire(`r${round}`, 'host', fireAt, state, privateState);
      const guest = fire(`r${round}`, 'guest', fireAt, host.state, host.privateState);
      expect(guest.state.phase).toBe('reveal');
      state = guest.state;
      privateState = guest.privateState;
      if (round < 5) {
        const next = advanceAim(state, privateState, fireAt + AIM_REVEAL_MS);
        expect(next.state.phase).toBe('open');
        expect(next.state.round.id).toBe(`r${round + 1}`);
        state = next.state;
        fireAt += AIM_REVEAL_MS;
      }
    }

    const finished = advanceAim(state, privateState, fireAt + AIM_REVEAL_MS);
    expect(finished.state.phase).toBe('finished');
    expect(finished.state.players.host.score).toBe(15);
    expect(finished.state.players.guest.score).toBe(15);
    expect(finished.state.result).toEqual({
      winner: null,
      draw: true,
      reason: 'rounds_complete',
      scores: { host: 15, guest: 15 },
      maxScore: 15,
    });
  });

  it('closes a round with no shots on the 8 second deadline', () => {
    const { state, privateState } = makeGame();
    const reveal = advanceAim(state, privateState, AIM_ROUND_MS);
    expect(reveal.changed).toBe(true);
    expect(reveal.state.phase).toBe('reveal');
    expect(reveal.state.round.shots).toEqual({ host: null, guest: null });
    expect(reveal.state.players.host.score).toBe(0);

    const next = advanceAim(reveal.state, privateState, AIM_ROUND_MS + AIM_REVEAL_MS);
    expect(next.state.phase).toBe('open');
    expect(next.state.round.id).toBe('r2');
  });

  it('rejects stale rounds, second shots and shots after the deadline', () => {
    const { state, privateState } = makeGame();
    expect(fire('r2', 'host', 100, state, privateState)).toMatchObject({
      ok: false,
      code: 'STALE_ROUND',
    });

    const first = fire('r1', 'host', 100, state, privateState);
    const second = fire('r1', 'host', 200, first.state, first.privateState);
    expect(second).toMatchObject({ ok: false, code: 'ALREADY_FIRED' });

    const late = fire('r1', 'guest', AIM_ROUND_MS + 1, state, privateState);
    expect(late).toMatchObject({ ok: false, code: 'ROUND_CLOSED' });
  });

  it('finishes on resign with the opponent as winner', () => {
    const { state, privateState } = makeGame();
    const resigned = applyAimAction({
      state,
      privateState,
      actorKey: 'guest',
      envelope: { actionId: 'act_resign_aim', roundId: 'r1', type: 'resign' },
      nowMs: 100,
    });
    expect(resigned.ok).toBe(true);
    expect(resigned.state.phase).toBe('finished');
    expect(resigned.state.result).toMatchObject({ winner: 'Alice', draw: false, reason: 'resign' });
  });

  it('does not mutate its arguments', () => {
    const { state, privateState } = makeGame();
    const snapshot = JSON.stringify({ state, privateState });
    fire('r1', 'host', 100, state, privateState);
    expect(JSON.stringify({ state, privateState })).toBe(snapshot);
  });
});
