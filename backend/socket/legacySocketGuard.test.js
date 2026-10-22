const { rejectLegacySocketAction } = require('./legacySocketGuard');

describe('rejectLegacySocketAction', () => {
  const makeSocket = () => ({ id: 's1', userId: 7, emit: jest.fn() });

  it('answers game_move with an explicit protocol error and relays nothing', () => {
    const socket = makeSocket();
    const logger = { warn: jest.fn() };

    rejectLegacySocketAction({
      socket,
      eventName: 'game_move',
      data: { gameId: '42', move: { action: 'game_over', score: 99999 } },
      normalizeGameId: (value) => String(value || '').trim() || null,
      logger,
    });

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('game_room_error', {
      code: 'LEGACY_PROTOCOL_DISABLED',
      event: 'game_move',
      gameId: '42',
    });
    expect(socket.emit.mock.calls.flat().join(' ')).not.toContain('game_state_updated');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('answers update_game_state without echoing the supplied state', () => {
    const socket = makeSocket();

    rejectLegacySocketAction({
      socket,
      eventName: 'update_game_state',
      data: { gameId: 9, state: { resolvedWinner: 'Alice', settlementApplied: true } },
      normalizeGameId: (value) => String(value || '').trim() || null,
      logger: { warn: jest.fn() },
    });

    const emitted = JSON.stringify(socket.emit.mock.calls);
    expect(emitted).toContain('LEGACY_PROTOCOL_DISABLED');
    expect(emitted).not.toContain('resolvedWinner');
    expect(emitted).not.toContain('settlementApplied');
  });
});
