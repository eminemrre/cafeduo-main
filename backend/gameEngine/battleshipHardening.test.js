/** @jest-environment node */
const { MAX_BATTLE_TURNS, CELL_COUNT, validateLayout } = require('../../shared/battleship');
const {
  normalizeActionEnvelope,
  recordActionReceipt,
  checkActionReceipt,
} = require('./actionProtocol');
const {
  createBattleshipPrivateState,
  createBattleshipPublicState,
  startBattleshipState,
  applyBattleshipAction,
} = require('./battleshipEngine');
const { serializeGameForActor } = require('./gameView');
const layout = [
  { cell: 0, dir: 'h' },
  { cell: 16, dir: 'v' },
  { cell: 21, dir: 'h' },
  { cell: 55, dir: 'v' },
];

describe('battleship review hardening', () => {
  it('caps the battle at the approved 64 cells per player, not an unapproved 200 turns', () => {
    expect(MAX_BATTLE_TURNS).toBe(2 * CELL_COUNT);
  });
  it.each(['', false, true, [], {}, null])('rejects coercible non-numeric target %p', (cell) => {
    const result = normalizeActionEnvelope({
      actionId: 'strict_fire_1',
      roundId: 'r2',
      type: 'fire',
      cell,
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_CELL' });
  });
  it('validates ship coordinates without coercing booleans or empty strings to a real bow', () => {
    expect(validateLayout([{ cell: false, dir: 'h' }, ...layout.slice(1)]).ok).toBe(false);
    expect(validateLayout([{ cell: '', dir: 'h' }, ...layout.slice(1)]).ok).toBe(false);
  });
  it('supports server-seeded random placement and refuses an ambiguous auto+layout request', () => {
    const result = normalizeActionEnvelope({
      actionId: 'server_auto_1',
      roundId: 'r1',
      type: 'place',
      auto: true,
    });
    expect(result).toMatchObject({ ok: true, envelope: { type: 'place', auto: true } });
    expect(
      normalizeActionEnvelope({
        actionId: 'server_auto_1',
        roundId: 'r1',
        type: 'place',
        auto: true,
        layout,
      }).ok
    ).toBe(false);
    const privateState = createBattleshipPrivateState();
    const state = startBattleshipState({
      state: createBattleshipPublicState({ hostName: 'Ada', guestName: 'Bora' }),
      privateState,
      hostName: 'Ada',
      guestName: 'Bora',
      nowMs: 100000,
    });
    const applied = applyBattleshipAction({
      state,
      privateState,
      actorKey: 'host',
      envelope: { actionId: 'server_auto_1', roundId: 'r1', type: 'place', auto: true },
      nowMs: 100100,
    });
    expect(applied.ok).toBe(true);
    expect(applied.privateState.fleets.host).toEqual(
      validateLayout(privateState.autoLayouts.host).ships
    );
  });
  it('anchors early battle to the latest accepted placement, even if lock order differs', () => {
    const privateState = createBattleshipPrivateState();
    const state = startBattleshipState({
      state: createBattleshipPublicState({ hostName: 'Ada', guestName: 'Bora' }),
      privateState,
      hostName: 'Ada',
      guestName: 'Bora',
      nowMs: 100000,
    });
    const host = applyBattleshipAction({
      state,
      privateState,
      actorKey: 'host',
      envelope: { type: 'place', roundId: 'r1', layout },
      nowMs: 103000,
    });
    const guest = applyBattleshipAction({
      state: host.state,
      privateState: host.privateState,
      actorKey: 'guest',
      envelope: { type: 'place', roundId: 'r1', layout },
      nowMs: 101000,
    });
    expect(guest.state.round.startedAt).toBe(new Date(103000).toISOString());
  });
  it('retains the whole legal placement+64-shot+resign ledger through JSONB key reordering', () => {
    let ledger = {};
    const first = { actionId: 'zz_initial_place', roundId: 'r1', type: 'place', layout };
    ledger = recordActionReceipt({
      ledger,
      actorKey: 'host',
      envelope: first,
      receipt: { revision: 1, at: new Date(0).toISOString() },
    });
    for (let index = 0; index < 65; index += 1) {
      const reordered = Object.fromEntries(
        Object.entries(ledger.host).sort(([a], [b]) => a.localeCompare(b))
      );
      ledger = recordActionReceipt({
        ledger: { host: reordered },
        actorKey: 'host',
        envelope: {
          actionId: `aa_fire_${index}`,
          roundId: `r${index + 2}`,
          type: 'fire',
          cell: index % 64,
        },
        receipt: { revision: index + 2 },
      });
    }
    expect(checkActionReceipt({ ledger, actorKey: 'host', envelope: first }).status).toBe(
      'duplicate'
    );
  });
  it('never invents an empty private fleet when the query did not select private state', () => {
    const privateState = createBattleshipPrivateState();
    const state = createBattleshipPublicState({ hostName: 'Ada', guestName: 'Bora' });
    state.players.host.placed = true;
    expect(privateState.fleets.host).toBeNull();
    const view = serializeGameForActor(
      {
        hostName: 'Ada',
        guestName: 'Bora',
        gameType: 'Amiral Battı',
        gameState: { engine: state },
      },
      'Ada'
    );
    expect(view.actorView).toBeUndefined();
  });
});
