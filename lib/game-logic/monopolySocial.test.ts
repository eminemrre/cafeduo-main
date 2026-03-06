import {
  BOARD,
  initMonopolyState,
  maybeEndMonopolyState,
  passStartBonus,
  resolveWinnerByCash,
  rollDice,
  settleMonopolyLanding,
} from './monopolySocial';

describe('monopolySocial game logic', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes default player state', () => {
    const state = initMonopolyState('Host', 'Guest');

    expect(state.hostPos).toBe(0);
    expect(state.guestPos).toBe(0);
    expect(state.hostCash).toBe(1500);
    expect(state.guestCash).toBe(1500);
    expect(state.turn).toBe('host');
    expect(state.message).toBe('Zar atarak başla.');
  });

  it('rolls dice between 1 and 6 and awards start bonus only on wrap', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    expect(rollDice()).toBe(6);
    expect(passStartBonus(18, 2)).toBe(200);
    expect(passStartBonus(3, 8)).toBe(0);
  });

  it('resolves winner by cash and ties', () => {
    expect(resolveWinnerByCash(1000, 800, 'Host', 'Guest')).toBe('Host');
    expect(resolveWinnerByCash(700, 900, 'Host', 'Guest')).toBe('Guest');
    expect(resolveWinnerByCash(700, 700, 'Host', 'Guest')).toBe('Berabere');
  });

  it('handles empty, owned, and rented tiles', () => {
    const base = initMonopolyState('Host', 'Guest');
    const openTileId = 3;

    const openLanding = settleMonopolyLanding(base, 'host', openTileId);
    expect(openLanding.pendingPurchase).toEqual({ owner: 'host', tileId: openTileId });
    expect(openLanding.message).toContain(BOARD[openTileId].name);

    const ownTile = settleMonopolyLanding(
      { ...base, properties: { [openTileId]: 'host' } },
      'host',
      openTileId
    );
    expect(ownTile.message).toContain('zaten sende');

    const rented = settleMonopolyLanding(
      { ...base, properties: { [openTileId]: 'guest' }, hostCash: 50, guestCash: 200 },
      'host',
      openTileId
    );
    expect(rented.hostCash).toBeLessThan(50);
    expect(rented.guestCash).toBeGreaterThan(200);
    expect(rented.message).toContain('kirası ödendi');
  });

  it('ends the game for bankruptcy or max turns', () => {
    const bankruptHost = maybeEndMonopolyState({
      ...initMonopolyState('Host', 'Guest'),
      hostCash: 0,
    });
    expect(bankruptHost.finished).toBe(true);
    expect(bankruptHost.winner).toBe('Guest');

    const bankruptGuest = maybeEndMonopolyState({
      ...initMonopolyState('Host', 'Guest'),
      guestCash: -5,
    });
    expect(bankruptGuest.finished).toBe(true);
    expect(bankruptGuest.winner).toBe('Host');

    const maxTurnsReached = maybeEndMonopolyState({
      ...initMonopolyState('Host', 'Guest'),
      turnCount: 30,
      hostCash: 1700,
      guestCash: 1200,
    });
    expect(maxTurnsReached.finished).toBe(true);
    expect(maxTurnsReached.winner).toBe('Host');
    expect(maxTurnsReached.message).toContain('Kazanan: Host');
  });
});
