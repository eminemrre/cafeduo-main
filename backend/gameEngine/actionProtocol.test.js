const {
  ACTION_TYPES,
  MAX_RECEIPTS_PER_PLAYER,
  checkActionReceipt,
  fingerprintAction,
  normalizeActionEnvelope,
  recordActionReceipt,
} = require('./actionProtocol');

const validBody = (overrides = {}) => ({
  actionId: 'act_12345678',
  roundId: 'r1',
  type: 'answer',
  optionIndex: 2,
  ...overrides,
});

describe('normalizeActionEnvelope', () => {
  it('accepts a well-formed answer and ignores a client timestamp', () => {
    const result = normalizeActionEnvelope({
      ...validBody(),
      clientSentAt: '1999-01-01T00:00:00.000Z',
      receivedAt: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.envelope).toEqual({
      actionId: 'act_12345678',
      roundId: 'r1',
      type: 'answer',
      optionIndex: 2,
    });
    expect(result.envelope.clientSentAt).toBeUndefined();
    expect(result.envelope.receivedAt).toBeUndefined();
  });

  it.each([
    ['actionId', { actionId: 'short' }, 'INVALID_ACTION_ID'],
    ['actionId', { actionId: 'has space 1234' }, 'INVALID_ACTION_ID'],
    ['roundId', { roundId: 'round-1' }, 'INVALID_ROUND_ID'],
    ['type', { type: 'game_over' }, 'INVALID_ACTION_TYPE'],
    ['optionIndex', { optionIndex: 9 }, 'INVALID_OPTION'],
    ['optionIndex', { optionIndex: 1.5 }, 'INVALID_OPTION'],
  ])('rejects a bad %s', (_label, overrides, code) => {
    const result = normalizeActionEnvelope(validBody(overrides));
    expect(result.ok).toBe(false);
    expect(result.code).toBe(code);
  });

  it('keeps an integer shot time on fire and fingerprints it', () => {
    const fire = validBody({ type: ACTION_TYPES.FIRE, optionIndex: undefined, shotAt: 1792670000123 });
    const result = normalizeActionEnvelope(fire);
    expect(result).toMatchObject({ ok: true, envelope: { type: 'fire', shotAt: 1792670000123 } });
    const moved = normalizeActionEnvelope({ ...fire, shotAt: 1792670000124 }).envelope;
    expect(fingerprintAction(moved)).not.toBe(fingerprintAction(result.envelope));
    // Only fire carries a shot time.
    const answer = normalizeActionEnvelope(validBody({ shotAt: 1792670000123 }));
    expect(answer.envelope.shotAt).toBeUndefined();
  });

  it.each([['string', '1792670000123'], ['float', 1.5], ['negative', -1], ['zero', 0], ['bool', true], ['huge', 2 ** 60]])(
    'rejects a %s shot time',
    (_label, shotAt) => {
      const result = normalizeActionEnvelope(
        validBody({ type: ACTION_TYPES.FIRE, optionIndex: undefined, shotAt })
      );
      expect(result).toMatchObject({ ok: false, code: 'INVALID_SHOT_TIME' });
    }
  );

  it('does not require an option for fire/joker/resign', () => {
    for (const type of [ACTION_TYPES.FIRE, ACTION_TYPES.JOKER, ACTION_TYPES.RESIGN]) {
      const result = normalizeActionEnvelope(validBody({ type, optionIndex: undefined }));
      expect(result.ok).toBe(true);
      expect(result.envelope.optionIndex).toBeUndefined();
    }
  });

  it('numbers rounds up to r999 for Amiral Battı turns', () => {
    expect(normalizeActionEnvelope(validBody({ roundId: 'r201' })).ok).toBe(true);
    expect(normalizeActionEnvelope(validBody({ roundId: 'r999' })).ok).toBe(true);
    expect(normalizeActionEnvelope(validBody({ roundId: 'r1000' })).code).toBe('INVALID_ROUND_ID');
    expect(normalizeActionEnvelope(validBody({ roundId: 'r0' })).code).toBe('INVALID_ROUND_ID');
  });

  it('keeps a valid target cell on fire and rejects one off the board', () => {
    const fire = normalizeActionEnvelope(validBody({ type: 'fire', cell: 63, optionIndex: 1 }));
    expect(fire.envelope).toEqual({
      actionId: 'act_12345678',
      roundId: 'r1',
      type: 'fire',
      cell: 63,
    });
    for (const cell of [64, -1, 2.5, 'A1']) {
      expect(normalizeActionEnvelope(validBody({ type: 'fire', cell })).code).toBe('INVALID_CELL');
    }
    expect(normalizeActionEnvelope(validBody({ type: 'fire', cell: null })).code).toBe(
      'INVALID_CELL'
    );
  });

  it('canonicalises a placement and drops anything but cell and direction', () => {
    const layout = [
      { cell: 0, dir: 'H', ships: 'ignored' },
      { cell: 16, dir: 'v' },
      { cell: 21, dir: 'h' },
      { cell: 55, dir: 'v', hit: true },
    ];
    const result = normalizeActionEnvelope(validBody({ type: 'place', layout }));
    expect(result.ok).toBe(true);
    expect(result.envelope.layout).toEqual([
      { cell: 0, dir: 'h' },
      { cell: 16, dir: 'v' },
      { cell: 21, dir: 'h' },
      { cell: 55, dir: 'v' },
    ]);
    for (const bad of [
      undefined,
      layout.slice(0, 3),
      [...layout, { cell: 1, dir: 'h' }],
      [{ cell: 70, dir: 'h' }, ...layout.slice(1)],
      [{ cell: 0, dir: 'd' }, ...layout.slice(1)],
    ]) {
      expect(normalizeActionEnvelope(validBody({ type: 'place', layout: bad })).code).toBe(
        'INVALID_LAYOUT'
      );
    }
  });
});

describe('action receipts', () => {
  const envelope = normalizeActionEnvelope(validBody()).envelope;

  it('treats an unseen action as new', () => {
    expect(checkActionReceipt({ ledger: {}, actorKey: 'host', envelope }).status).toBe('new');
  });

  it('returns the receipt for an exact retry', () => {
    const ledger = recordActionReceipt({
      ledger: {},
      actorKey: 'host',
      envelope,
      receipt: { status: 'applied', revision: 5, at: '2026-10-21T10:00:00.000Z' },
    });

    const check = checkActionReceipt({ ledger, actorKey: 'host', envelope });
    expect(check.status).toBe('duplicate');
    expect(check.receipt.revision).toBe(5);
    expect(check.receipt.fingerprint).toBe(fingerprintAction(envelope));
  });

  it('reuses an actionId with a different payload as a conflict', () => {
    const ledger = recordActionReceipt({
      ledger: {},
      actorKey: 'host',
      envelope,
      receipt: { status: 'applied', revision: 1 },
    });

    const changed = normalizeActionEnvelope(validBody({ optionIndex: 3 })).envelope;
    expect(checkActionReceipt({ ledger, actorKey: 'host', envelope: changed }).status).toBe(
      'conflict'
    );
  });

  it('keeps players’ ledgers separate', () => {
    const ledger = recordActionReceipt({
      ledger: {},
      actorKey: 'host',
      envelope,
      receipt: { status: 'applied', revision: 1 },
    });
    expect(checkActionReceipt({ ledger, actorKey: 'guest', envelope }).status).toBe('new');
  });

  it('bounds the ledger per player', () => {
    let ledger = {};
    for (let i = 0; i < MAX_RECEIPTS_PER_PLAYER + 6; i += 1) {
      const next = normalizeActionEnvelope(
        validBody({ actionId: `act_${String(i).padStart(8, '0')}` })
      ).envelope;
      ledger = recordActionReceipt({
        ledger,
        actorKey: 'host',
        envelope: next,
        receipt: { status: 'applied', revision: i },
      });
    }
    expect(Object.keys(ledger.host)).toHaveLength(MAX_RECEIPTS_PER_PLAYER);
    expect(ledger.host.act_00000000).toBeUndefined();
    expect(
      ledger.host[`act_${String(MAX_RECEIPTS_PER_PLAYER + 5).padStart(8, '0')}`]
    ).toBeDefined();
  });
});
