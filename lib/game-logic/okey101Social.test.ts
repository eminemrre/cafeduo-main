import {
  calcMeldScore,
  countColorRuns,
  countSameValueSets,
  createTileDeck,
  drawFromDeck,
  hasWinningShape,
  initOkeyState,
  type OkeyState,
} from './okey101Social';

describe('okey101Social game logic', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the full Okey tile deck', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const deck = createTileDeck();

    expect(deck).toHaveLength(104);
    expect(new Set(deck.map((tile) => tile.id)).size).toBe(104);
  });

  it('counts color runs correctly', () => {
    const tiles = [
      { id: 'r1', color: 'kirmizi' as const, value: 1 },
      { id: 'r2', color: 'kirmizi' as const, value: 2 },
      { id: 'r3', color: 'kirmizi' as const, value: 3 },
      { id: 'b8', color: 'mavi' as const, value: 8 },
      { id: 'b9', color: 'mavi' as const, value: 9 },
      { id: 'b10', color: 'mavi' as const, value: 10 },
    ];

    expect(countColorRuns(tiles)).toBe(2);
  });

  it('counts same-value sets across distinct colors', () => {
    const tiles = [
      { id: 'r7', color: 'kirmizi' as const, value: 7 },
      { id: 'b7', color: 'mavi' as const, value: 7 },
      { id: 's7', color: 'sari' as const, value: 7 },
      { id: 'x9', color: 'siyah' as const, value: 9 },
    ];

    expect(countSameValueSets(tiles)).toBe(1);
  });

  it('scores winning hands from runs and sets', () => {
    const winningTiles = [
      { id: 'r1', color: 'kirmizi' as const, value: 1 },
      { id: 'r2', color: 'kirmizi' as const, value: 2 },
      { id: 'r3', color: 'kirmizi' as const, value: 3 },
      { id: 'm7', color: 'mavi' as const, value: 7 },
      { id: 's7', color: 'sari' as const, value: 7 },
      { id: 'k7', color: 'siyah' as const, value: 7 },
      { id: 'm10', color: 'mavi' as const, value: 10 },
      { id: 'm11', color: 'mavi' as const, value: 11 },
      { id: 'm12', color: 'mavi' as const, value: 12 },
    ];

    expect(calcMeldScore(winningTiles)).toBe(3);
    expect(hasWinningShape(winningTiles)).toBe(true);
  });

  it('initializes hands, discard pile and deck sizes', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const state = initOkeyState('Host', 'Guest');

    expect(state.hostHand).toHaveLength(14);
    expect(state.guestHand).toHaveLength(14);
    expect(state.discardPile).toHaveLength(1);
    expect(state.deck).toHaveLength(75);
    expect(state.mustDraw).toBe(true);
  });

  it('draws from deck and handles empty deck safely', () => {
    const emptyState: OkeyState = {
      deck: [],
      discardPile: [],
      hostHand: [],
      guestHand: [],
      turn: 'host',
      mustDraw: true,
      finished: false,
      winner: null,
      message: '',
      hostName: 'Host',
      guestName: 'Guest',
    };

    expect(drawFromDeck(emptyState)).toEqual({ nextState: emptyState, tile: null });

    const stateWithDeck: OkeyState = {
      ...emptyState,
      deck: [{ id: 'x', color: 'sari', value: 5 }],
    };

    const { tile, nextState } = drawFromDeck(stateWithDeck);
    expect(tile).toEqual({ id: 'x', color: 'sari', value: 5 });
    expect(nextState.deck).toEqual([]);
  });
});
