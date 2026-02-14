const {
  GAME_STATUS,
  normalizeGameStatus,
  canTransitionGameStatus,
  assertGameStatusTransition,
  assertRequiredGameStatus,
} = require('./gameStateMachine');

describe('gameStateMachine', () => {
  it('normalizes status safely', () => {
    expect(normalizeGameStatus(' ACTIVE ')).toBe('active');
    expect(normalizeGameStatus(null)).toBe('');
  });

  it('allows waiting -> active', () => {
    expect(canTransitionGameStatus(GAME_STATUS.WAITING, GAME_STATUS.ACTIVE)).toBe(true);
  });

  it('allows waiting -> finished', () => {
    expect(canTransitionGameStatus(GAME_STATUS.WAITING, GAME_STATUS.FINISHED)).toBe(true);
  });

  it('allows active -> active', () => {
    expect(canTransitionGameStatus(GAME_STATUS.ACTIVE, GAME_STATUS.ACTIVE)).toBe(true);
  });

  it('allows active -> finishing', () => {
    expect(canTransitionGameStatus(GAME_STATUS.ACTIVE, GAME_STATUS.FINISHING)).toBe(true);
  });

  it('allows finishing -> finished', () => {
    expect(canTransitionGameStatus(GAME_STATUS.FINISHING, GAME_STATUS.FINISHED)).toBe(true);
  });

  it('blocks waiting -> finishing', () => {
    expect(canTransitionGameStatus(GAME_STATUS.WAITING, GAME_STATUS.FINISHING)).toBe(false);
  });

  it('blocks finished -> active', () => {
    expect(canTransitionGameStatus(GAME_STATUS.FINISHED, GAME_STATUS.ACTIVE)).toBe(false);
  });

  it('returns typed error for invalid transition', () => {
    const result = assertGameStatusTransition({
      fromStatus: GAME_STATUS.WAITING,
      toStatus: GAME_STATUS.FINISHING,
      context: 'test_case',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_status_transition');
    expect(result.message).toContain('waiting -> finishing');
  });

  it('returns typed error for invalid status input', () => {
    const result = assertGameStatusTransition({
      fromStatus: 'broken',
      toStatus: GAME_STATUS.ACTIVE,
      context: 'test_case',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_game_status');
  });

  it('accepts required status when current status matches', () => {
    const result = assertRequiredGameStatus({
      currentStatus: GAME_STATUS.ACTIVE,
      requiredStatus: GAME_STATUS.ACTIVE,
      context: 'active_only_endpoint',
    });

    expect(result.ok).toBe(true);
    expect(result.from).toBe('active');
    expect(result.to).toBe('active');
  });

  it('returns transition error when required status does not match current status', () => {
    const result = assertRequiredGameStatus({
      currentStatus: GAME_STATUS.WAITING,
      requiredStatus: GAME_STATUS.ACTIVE,
      context: 'active_only_endpoint',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_status_transition');
    expect(result.message).toContain('waiting -> active');
  });
});
