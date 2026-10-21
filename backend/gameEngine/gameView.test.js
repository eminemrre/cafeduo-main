const {
  isAimType,
  isChessType,
  isQuizType,
  serializeGameForActor,
  serializeGameState,
  serializeLobbyGame,
} = require('./gameView');

const dbQuizRow = () => ({
  id: 9,
  host_name: 'Alice',
  game_type: 'Bilgi Yarışı',
  points: 20,
  table_code: 'MASA05',
  status: 'active',
  guest_name: 'Bob',
  winner: null,
  player1_move: 'legacy-move',
  player2_move: null,
  created_at: '2026-10-21T10:00:00.000Z',
  game_state: {
    engine: {
      version: 2,
      kind: 'quiz',
      revision: 4,
      phase: 'open',
      roundIndex: 1,
      totalRounds: 10,
      startedAt: '2026-10-21T10:00:00.000Z',
      phaseEndsAt: '2026-10-21T10:00:15.000Z',
      updatedAt: '2026-10-21T10:00:00.000Z',
      players: {
        host: { name: 'Alice', score: 10, answered: false, jokerUsed: false, receivedAt: 123 },
        guest: { name: 'Bob', score: 0, answered: true, jokerUsed: true, receivedAt: 456 },
      },
      round: {
        id: 'r1',
        index: 0,
        question: 'Soru?',
        options: ['A', 'B', 'C', 'D'],
        category: 'Bilgi',
        level: 'orta',
        answerIndex: 1,
        correctIndex: null,
        future: ['gizli'],
        picks: { host: null, guest: 2 },
      },
      private: { answerKey: [1, 2, 3] },
      actions: { host: { act_12345678: { fingerprint: 'x' } } },
      result: null,
    },
    results: { Alice: 320, Bob: 0 },
    resolvedWinner: 'Alice',
    settlementApplied: true,
    stakeTransferred: 20,
    live: { score: 320 },
  },
  game_private_state: {
    engine: { questions: [{ answerIndex: 1 }], actions: { host: {} } },
  },
});

describe('gameView serializers', () => {
  it('returns only allowlisted top-level game fields', () => {
    const view = serializeGameForActor(dbQuizRow());

    expect(view).toEqual(
      expect.objectContaining({
        id: 9,
        hostName: 'Alice',
        gameType: 'Bilgi Yarışı',
        points: 20,
        table: 'MASA05',
        status: 'active',
        guestName: 'Bob',
        protocolVersion: 2,
      })
    );
    expect(view.game_private_state).toBeUndefined();
    expect(view.player1Move).toBeUndefined();
  });

  it('drops answer keys, future questions, action receipts and legacy results', () => {
    const view = serializeGameForActor(dbQuizRow());
    const engine = view.gameState.engine;

    expect(engine.answerIndex).toBeUndefined();
    expect(engine.private).toBeUndefined();
    expect(engine.actions).toBeUndefined();
    expect(engine.round.answerIndex).toBeUndefined();
    expect(engine.round.future).toBeUndefined();
    expect(engine.round.correctIndex).toBeUndefined();
    expect(view.gameState.results).toBeUndefined();
    expect(view.gameState.resolvedWinner).toBeUndefined();
    expect(view.gameState.settlementApplied).toBeUndefined();
    expect(view.gameState.stakeTransferred).toBeUndefined();
    expect(view.gameState.live).toBeUndefined();
    expect(engine.players.host.receivedAt).toBeUndefined();
    expect(engine.players.guest.score).toBe(0);
  });

  it('keeps the public question and revealed answer only when the engine sets it', () => {
    const row = dbQuizRow();
    row.game_state.engine.round.correctIndex = 1;
    const view = serializeGameForActor(row);
    expect(view.gameState.engine.round.options).toEqual(['A', 'B', 'C', 'D']);
    expect(view.gameState.engine.round.correctIndex).toBe(1);
  });

  it('ignores a raw legacy quiz blob with no engine', () => {
    const row = dbQuizRow();
    delete row.game_state.engine;
    const view = serializeGameForActor(row);
    expect(view.gameState).toEqual({});
  });

  it('preserves the server-owned chess state and drops unknown keys', () => {
    const row = {
      id: 3,
      host_name: 'A',
      game_type: 'Retro Satranç',
      points: 0,
      table_code: 'MASA01',
      status: 'finished',
      guest_name: 'B',
      winner: 'A',
      player1_move: 'e4',
      player2_move: 'e5',
      game_state: {
        chess: { fen: '8/8/8/8/8/8/8/8 w - - 0 1', moveHistory: [] },
        resolvedWinner: 'A',
        stakeTransferred: 0,
        settlementApplied: true,
        settledAt: '2026-10-21T10:00:00.000Z',
        results: { A: 9 },
        secret: 'never',
      },
    };

    const view = serializeGameForActor(row);
    expect(view.gameState.chess.fen).toBeDefined();
    expect(view.gameState.resolvedWinner).toBe('A');
    expect(view.gameState.stakeTransferred).toBe(0);
    expect(view.gameState.settlementApplied).toBe(true);
    expect(view.gameState.results).toBeUndefined();
    expect(view.gameState.secret).toBeUndefined();
    expect(view.player1Move).toBe('e4');
    expect(view.protocolVersion).toBeUndefined();
  });

  it('serializes an aim trajectory and revealed shots but no private data', () => {
    const row = {
      id: 12,
      host_name: 'Alice',
      game_type: 'Nişancı Düellosu',
      points: 10,
      table_code: 'MASA01',
      status: 'active',
      guest_name: 'Bob',
      winner: null,
      game_state: {
        engine: {
          version: 2,
          kind: 'aim',
          revision: 3,
          phase: 'reveal',
          roundIndex: 1,
          totalRounds: 5,
          players: {
            host: { name: 'Alice', score: 3, hits: 1 },
            guest: { name: 'Bob', score: 0, hits: 0 },
          },
          round: {
            id: 'r1',
            index: 0,
            trajectory: { start: 50, direction: 1, speed: 0.1 },
            shots: {
              host: { position: 50, points: 3, extra: 'drop' },
              guest: null,
            },
            scoreDelta: { host: 3, guest: 0 },
            private: { shots: ['secret'] },
          },
          private: { rounds: [{ trajectory: { start: 1 } }] },
        },
      },
      game_private_state: { version: 2, shots: { r1: { host: { position: 50 } } } },
    };

    const view = serializeGameForActor(row);
    const engine = view.gameState.engine;
    expect(engine.round.trajectory).toEqual({ start: 50, direction: 1, speed: 0.1 });
    expect(engine.round.shots).toEqual({ host: { position: 50, points: 3 }, guest: null });
    expect(engine.round.private).toBeUndefined();
    expect(engine.private).toBeUndefined();
    expect(view.gamePrivateState).toBeUndefined();
    expect(view.game_private_state).toBeUndefined();
    expect(view.player1Move).toBeUndefined();
  });

  it('returns an empty state for unknown game types', () => {
    expect(serializeGameState('Bilinmeyen', { engine: {}, result: 'x' })).toEqual({});
    expect(isChessType('Retro Satranç')).toBe(true);
    expect(isQuizType('Bilgi Yarışı')).toBe(true);
    expect(isAimType('Nişancı Düellosu')).toBe(true);
    expect(isAimType('Retro Satranç')).toBe(false);
  });

  it('never leaks state through the lobby serializer', () => {
    const lobby = serializeLobbyGame(dbQuizRow());
    expect(lobby).toEqual({
      id: 9,
      hostName: 'Alice',
      gameType: 'Bilgi Yarışı',
      points: 20,
      table: 'MASA05',
      status: 'active',
      guestName: 'Bob',
      createdAt: '2026-10-21T10:00:00.000Z',
    });
    expect(lobby.gameState).toBeUndefined();
    expect(lobby.game_private_state).toBeUndefined();
  });

  it('handles null rows', () => {
    expect(serializeGameForActor(null)).toBeNull();
    expect(serializeLobbyGame(null)).toBeNull();
  });
});
