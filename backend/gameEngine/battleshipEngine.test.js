const {
  advanceBattleship,
  applyBattleshipAction,
  createBattleshipPrivateState,
  createBattleshipPublicState,
  startBattleshipState,
} = require('./battleshipEngine');
const {
  MAX_BATTLE_TURNS,
  MAX_MISSED_TURNS,
  PLACEMENT_MS,
  TURN_MS,
  validateLayout,
} = require('../../shared/battleship');

// Host fleet: A1-D1, A3-A5, F3-H3, H7-H8.
const HOST_LAYOUT = [
  { cell: 0, dir: 'h' },
  { cell: 16, dir: 'v' },
  { cell: 21, dir: 'h' },
  { cell: 55, dir: 'v' },
];
// Guest fleet: A8-D8, H1-H3, C3-C5, E5-F5.
const GUEST_LAYOUT = [
  { cell: 56, dir: 'h' },
  { cell: 7, dir: 'v' },
  { cell: 18, dir: 'v' },
  { cell: 36, dir: 'h' },
];
const GUEST_CELLS = validateLayout(GUEST_LAYOUT).ships.flatMap((ship) => ship.cells);
const HOST_CELLS = validateLayout(HOST_LAYOUT).ships.flatMap((ship) => ship.cells);
const EMPTY_FOR_HOST = Array.from({ length: 64 }, (_, i) => i).filter(
  (cell) => !HOST_CELLS.includes(cell)
);
const EMPTY_FOR_GUEST = Array.from({ length: 64 }, (_, i) => i).filter(
  (cell) => !GUEST_CELLS.includes(cell)
);

let counter = 0;
const act = (game, actorKey, type, extra = {}, nowMs = game.now) => {
  counter += 1;
  const result = applyBattleshipAction({
    state: game.state,
    privateState: game.privateState,
    actorKey,
    envelope: {
      actionId: `act_${actorKey}_${counter}`,
      roundId: extra.roundId || game.state.round?.id,
      type,
      ...extra,
    },
    nowMs,
  });
  if (result.ok) {
    game.state = result.state;
    game.privateState = result.privateState;
  }
  return result;
};

const newGame = ({ firstTurn = 'host', nowMs = 1_000_000 } = {}) => {
  let seed = 11;
  let firstDraw = true;
  const privateState = createBattleshipPrivateState({
    randomInt: (max) => {
      if (firstDraw) {
        firstDraw = false;
        return firstTurn === 'host' ? 0 : 1;
      }
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    },
  });
  // Deterministic auto layouts for timeout tests.
  privateState.autoLayouts = { host: HOST_LAYOUT, guest: GUEST_LAYOUT };
  const state = startBattleshipState({
    state: createBattleshipPublicState({ hostName: 'Ada', guestName: 'Bora' }),
    privateState,
    hostName: 'Ada',
    guestName: 'Bora',
    nowMs,
  });
  return { state, privateState, now: nowMs };
};

const placeBoth = (game) => {
  expect(act(game, 'host', 'place', { layout: HOST_LAYOUT }).ok).toBe(true);
  expect(act(game, 'guest', 'place', { layout: GUEST_LAYOUT }, game.now + 500).ok).toBe(true);
  game.now += 500;
  return game;
};

const json = (value) => JSON.stringify(value);

describe('battleshipEngine', () => {
  it('seeds both auto layouts and the first turn privately', () => {
    const privateState = createBattleshipPrivateState();
    expect(privateState).toMatchObject({ version: 2, kind: 'battleship' });
    expect(['host', 'guest']).toContain(privateState.firstTurn);
    expect(validateLayout(privateState.autoLayouts.host).ok).toBe(true);
    expect(validateLayout(privateState.autoLayouts.guest).ok).toBe(true);
    expect(privateState.fleets).toEqual({ host: null, guest: null });
  });

  it('opens a 45 s placement round that reveals no fleet', () => {
    const game = newGame();
    expect(game.state.phase).toBe('placement');
    expect(game.state.round).toMatchObject({ id: 'r1', phase: 'placement', turn: null });
    expect(Date.parse(game.state.round.endsAt) - Date.parse(game.state.round.startedAt)).toBe(
      PLACEMENT_MS
    );
    expect(json(game.state)).not.toMatch(/autoLayouts|fleets|firstTurn/);
  });

  it('keeps each fleet private and starts the battle when the second player places', () => {
    const game = newGame({ firstTurn: 'guest' });
    act(game, 'host', 'place', { layout: HOST_LAYOUT });
    expect(game.state.players.host.placed).toBe(true);
    expect(game.state.phase).toBe('placement');
    expect(game.privateState.fleets.host).toHaveLength(4);
    expect(json(game.state)).not.toContain('"cells":[0,1,2,3]');

    const second = act(game, 'guest', 'place', { layout: GUEST_LAYOUT }, game.now + 1200);
    expect(second.ok).toBe(true);
    expect(game.state.phase).toBe('battle');
    // The early close starts the battle at the latest accepted action, not the deadline.
    expect(game.state.round).toMatchObject({ id: 'r2', turn: 'guest' });
    expect(game.state.round.startedAt).toBe(new Date(game.now + 1200).toISOString());
    expect(json(game.state)).not.toMatch(/"cells":\[56|autoLayouts/);
  });

  it('rejects a second placement, an invalid layout and placement after the battle starts', () => {
    const game = newGame();
    expect(act(game, 'host', 'place', { layout: HOST_LAYOUT.slice(0, 3) })).toMatchObject({
      ok: false,
      code: 'INVALID_LAYOUT',
    });
    expect(
      act(game, 'host', 'place', {
        layout: [...HOST_LAYOUT.slice(0, 3), { cell: 1, dir: 'v' }],
      })
    ).toMatchObject({ ok: false, code: 'SHIPS_OVERLAP' });
    act(game, 'host', 'place', { layout: HOST_LAYOUT });
    expect(act(game, 'host', 'place', { layout: GUEST_LAYOUT })).toMatchObject({
      ok: false,
      code: 'ALREADY_PLACED',
    });
    act(game, 'guest', 'place', { layout: GUEST_LAYOUT });
    expect(act(game, 'guest', 'place', { layout: GUEST_LAYOUT, roundId: 'r2' })).toMatchObject({
      ok: false,
      code: 'PLACEMENT_CLOSED',
    });
  });

  it('alternates turns, reports hit/miss/sunk and never gives an extra shot on a hit', () => {
    const game = placeBoth(newGame({ firstTurn: 'host' }));
    expect(act(game, 'guest', 'fire', { cell: 0 })).toMatchObject({
      ok: false,
      code: 'NOT_YOUR_TURN',
    });

    const hit = act(game, 'host', 'fire', { cell: 36 });
    expect(hit.ok).toBe(true);
    expect(game.state.boards.guest.shots).toEqual([{ cell: 36, hit: true }]);
    expect(game.state.lastShot).toMatchObject({ by: 'host', cell: 36, hit: true, sunkSize: null });
    expect(game.state.round).toMatchObject({ id: 'r3', turn: 'guest' });

    act(game, 'guest', 'fire', { cell: EMPTY_FOR_HOST[0] });
    expect(game.state.boards.host.shots).toEqual([{ cell: EMPTY_FOR_HOST[0], hit: false }]);

    act(game, 'host', 'fire', { cell: 37 });
    expect(game.state.boards.guest.sunk).toEqual([{ size: 2, cells: [36, 37] }]);
    expect(game.state.lastShot).toMatchObject({ hit: true, sunkSize: 2 });
    expect(game.state.players.host.hits).toBe(2);
  });

  it('rejects a repeated cell, a missing cell and a stale turn id', () => {
    const game = placeBoth(newGame({ firstTurn: 'host' }));
    act(game, 'host', 'fire', { cell: 10 });
    act(game, 'guest', 'fire', { cell: EMPTY_FOR_HOST[0] });
    expect(act(game, 'host', 'fire', { cell: 10 })).toMatchObject({
      ok: false,
      code: 'CELL_ALREADY_SHOT',
    });
    expect(act(game, 'host', 'fire', {})).toMatchObject({ ok: false, code: 'INVALID_CELL' });
    expect(act(game, 'host', 'fire', { cell: 11, roundId: 'r3' })).toMatchObject({
      ok: false,
      code: 'STALE_ROUND',
    });
  });

  it('ends when a fleet is sunk and scores hits', () => {
    const game = placeBoth(newGame({ firstTurn: 'host' }));
    GUEST_CELLS.forEach((cell, index) => {
      expect(act(game, 'host', 'fire', { cell }).ok).toBe(true);
      if (index < GUEST_CELLS.length - 1) {
        expect(act(game, 'guest', 'fire', { cell: EMPTY_FOR_HOST[index] }).ok).toBe(true);
      }
    });
    expect(game.state.phase).toBe('finished');
    expect(game.state.result).toMatchObject({
      winner: 'Ada',
      draw: false,
      reason: 'fleet_sunk',
      scores: { host: 12, guest: 0 },
      maxScore: 12,
    });
    expect(game.state.boards.guest.sunk).toHaveLength(4);
    expect(act(game, 'guest', 'fire', { cell: 0 })).toMatchObject({
      ok: false,
      code: 'GAME_FINISHED',
    });
  });

  it('auto-places a missing fleet from the persisted deadline', () => {
    const game = newGame({ firstTurn: 'host' });
    act(game, 'host', 'place', { layout: HOST_LAYOUT });
    const deadline = Date.parse(game.state.round.endsAt);
    const { state, changed } = advanceBattleship(game.state, game.privateState, deadline + 5_000);
    expect(changed).toBe(true);
    expect(state.phase).toBe('battle');
    expect(state.players.guest).toMatchObject({ placed: true, autoPlaced: true });
    expect(state.round.startedAt).toBe(new Date(deadline).toISOString());
    expect(state.round.endsAt).toBe(new Date(deadline + TURN_MS).toISOString());
  });

  it('closes a match nobody placed in as abandoned', () => {
    const game = newGame();
    const deadline = Date.parse(game.state.round.endsAt);
    const { state } = advanceBattleship(game.state, game.privateState, deadline);
    expect(state.phase).toBe('finished');
    expect(state.result).toMatchObject({ winner: null, draw: true, reason: 'abandoned' });
  });

  it('counts a missed turn, passes it, and forfeits after three in a row', () => {
    const game = placeBoth(newGame({ firstTurn: 'host' }));
    const firstEnd = Date.parse(game.state.round.endsAt);
    // Host misses r2; guest gets r3 from the old deadline.
    let next = advanceBattleship(game.state, game.privateState, firstEnd + 1).state;
    expect(next.players.host.missedTurns).toBe(1);
    expect(next.round).toMatchObject({ id: 'r3', turn: 'guest' });
    expect(next.round.startedAt).toBe(new Date(firstEnd).toISOString());

    // A shot resets the streak.
    game.state = next;
    act(game, 'guest', 'fire', { cell: EMPTY_FOR_HOST[0] }, firstEnd + 1000);
    act(game, 'host', 'fire', { cell: EMPTY_FOR_GUEST[0] }, firstEnd + 2000);
    expect(game.state.players.host.missedTurns).toBe(0);

    // Both vanish: guest's turn misses first, then they alternate.
    const hostTurnStart = Date.parse(game.state.round.startedAt);
    next = advanceBattleship(
      game.state,
      game.privateState,
      hostTurnStart + TURN_MS * (2 * MAX_MISSED_TURNS) + 1
    ).state;
    expect(next.phase).toBe('finished');
    expect(next.result).toMatchObject({ winner: 'Ada', reason: 'timeout' });
    expect(next.players.guest.missedTurns).toBe(MAX_MISSED_TURNS);
    expect(next.players.host.missedTurns).toBe(MAX_MISSED_TURNS - 1);
  });

  it('catches up a whole silent match in one bounded call (restart or clock jump)', () => {
    const game = placeBoth(newGame({ firstTurn: 'guest' }));
    const { state, changed } = advanceBattleship(
      game.state,
      game.privateState,
      game.now + 60 * 60 * 1000
    );
    expect(changed).toBe(true);
    expect(state.phase).toBe('finished');
    expect(state.result).toMatchObject({ winner: 'Ada', reason: 'timeout' });
    // The forfeit happened at a persisted deadline, not at the reader's clock.
    const expectedAt =
      Date.parse(game.state.round.startedAt) + TURN_MS * (2 * MAX_MISSED_TURNS - 1);
    expect(state.phaseEndsAt).toBe(new Date(expectedAt).toISOString());
  });

  it('does not reopen a closed turn for an action that arrived before the new turn', () => {
    const game = placeBoth(newGame({ firstTurn: 'host' }));
    const deadline = Date.parse(game.state.round.endsAt);
    // A worker already passed the host's turn to the guest at the deadline.
    game.state = advanceBattleship(game.state, game.privateState, deadline + 10).state;
    // The guest's request was received before that turn existed.
    const early = act(game, 'guest', 'fire', { cell: 5 }, deadline - 1);
    expect(early).toMatchObject({ ok: false, code: 'ACTION_BEFORE_ROUND' });
    // The host's late shot carries the closed turn id.
    expect(act(game, 'host', 'fire', { cell: 5, roundId: 'r2' }, deadline + 20)).toMatchObject({
      ok: false,
      code: 'STALE_ROUND',
    });
  });

  it('settles on hits at the turn cap', () => {
    const game = placeBoth(newGame({ firstTurn: 'host' }));
    const capped = JSON.parse(JSON.stringify(game.state));
    capped.roundIndex = MAX_BATTLE_TURNS + 1; // r2..r201 used
    capped.round.id = `r${capped.roundIndex}`;
    capped.players.host.hits = 3;
    capped.players.guest.hits = 5;
    game.state = capped;
    act(game, 'host', 'fire', { cell: EMPTY_FOR_GUEST[0] });
    expect(game.state.phase).toBe('finished');
    expect(game.state.result).toMatchObject({ winner: 'Bora', reason: 'turn_limit' });
  });

  it('lets either player resign in any open phase', () => {
    const game = newGame();
    const result = act(game, 'guest', 'resign');
    expect(result.ok).toBe(true);
    expect(game.state.result).toMatchObject({ winner: 'Ada', reason: 'resign' });
  });

  it('does not mutate the arguments', () => {
    const game = placeBoth(newGame());
    const snapshot = json({ state: game.state, privateState: game.privateState });
    applyBattleshipAction({
      state: game.state,
      privateState: game.privateState,
      actorKey: 'host',
      envelope: { actionId: 'act_frozen_1', roundId: game.state.round.id, type: 'fire', cell: 9 },
      nowMs: game.now,
    });
    advanceBattleship(game.state, game.privateState, game.now + 10 * TURN_MS);
    expect(json({ state: game.state, privateState: game.privateState })).toBe(snapshot);
  });
});
