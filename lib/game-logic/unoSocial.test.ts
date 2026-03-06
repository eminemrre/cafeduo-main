import {
  canPlay,
  drawOne,
  initUnoState,
  makeDeck,
  type UnoState,
} from './unoSocial';

describe('unoSocial game logic', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a full deck with two copies of each color-number pair', () => {
    const deck = makeDeck();

    expect(deck).toHaveLength(80);

    const counts = new Map<string, number>();
    for (const card of deck) {
      const key = `${card.color}-${card.number}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    expect(counts.size).toBe(40);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
  });

  it('allows plays by matching color or number', () => {
    const top = { id: 'r-5', color: 'red' as const, number: 5 };

    expect(canPlay({ id: 'r-8', color: 'red', number: 8 }, top)).toBe(true);
    expect(canPlay({ id: 'b-5', color: 'blue', number: 5 }, top)).toBe(true);
    expect(canPlay({ id: 'g-7', color: 'green', number: 7 }, top)).toBe(false);
  });

  it('draws from deck when cards remain', () => {
    const state: UnoState = {
      deck: [
        { id: 'a', color: 'red', number: 1 },
        { id: 'b', color: 'blue', number: 2 },
      ],
      discard: [{ id: 'top', color: 'yellow', number: 4 }],
      hostHand: [],
      guestHand: [],
      turn: 'host',
      message: '',
      finished: false,
      winner: null,
      hostName: 'Host',
      guestName: 'Guest',
    };

    const { card, nextState } = drawOne(state);

    expect(card).toEqual({ id: 'a', color: 'red', number: 1 });
    expect(nextState.deck).toEqual([{ id: 'b', color: 'blue', number: 2 }]);
    expect(nextState.discard).toEqual(state.discard);
  });

  it('recycles discard pile when deck is empty', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const state: UnoState = {
      deck: [],
      discard: [
        { id: 'old-1', color: 'red', number: 1 },
        { id: 'old-2', color: 'blue', number: 2 },
        { id: 'top', color: 'yellow', number: 4 },
      ],
      hostHand: [],
      guestHand: [],
      turn: 'host',
      message: '',
      finished: false,
      winner: null,
      hostName: 'Host',
      guestName: 'Guest',
    };

    const { card, nextState } = drawOne(state);

    expect(card).not.toBeNull();
    expect(nextState.discard).toEqual([{ id: 'top', color: 'yellow', number: 4 }]);
    expect(nextState.deck).toHaveLength(1);
  });

  it('initializes a playable opening state', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const state = initUnoState('Host', 'Guest');

    expect(state.hostHand).toHaveLength(7);
    expect(state.guestHand).toHaveLength(7);
    expect(state.discard).toHaveLength(1);
    expect(state.deck).toHaveLength(65);
    expect(state.turn).toBe('host');
    expect(state.hostName).toBe('Host');
    expect(state.guestName).toBe('Guest');
  });
});
