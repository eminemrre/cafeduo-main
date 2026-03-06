import {
  buildMemoryDeck,
  canFlipCard,
  getPlayerFlippedIndices,
  pickBotPair,
  type MemoryCard,
} from './memoryDuel';

const makeCard = (overrides: Partial<MemoryCard> = {}): MemoryCard => ({
  id: 0,
  emoji: '🚀',
  flippedBy: null,
  matchedBy: null,
  ...overrides,
});

describe('memoryDuel game logic', () => {
  it('builds a 16-card deck with emoji pairs', () => {
    const deck = buildMemoryDeck(() => 0);

    expect(deck).toHaveLength(16);
    expect(deck.map((card) => card.id)).toEqual([...Array(16).keys()]);

    const counts = new Map<string, number>();
    for (const card of deck) {
      counts.set(card.emoji, (counts.get(card.emoji) || 0) + 1);
    }

    expect(counts.size).toBe(8);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
  });

  it('returns deterministic order when random source is fixed', () => {
    const values = [0.9, 0.2, 0.8, 0.1, 0.7, 0.3, 0.6, 0.4, 0.5];
    let index = 0;
    const randomFn = () => values[index++ % values.length];

    const deckA = buildMemoryDeck(randomFn);
    index = 0;
    const deckB = buildMemoryDeck(randomFn);

    expect(deckA.map((card) => card.emoji)).toEqual(deckB.map((card) => card.emoji));
  });

  it('collects flipped indices for the active player only', () => {
    const cards: MemoryCard[] = [
      makeCard({ id: 0, flippedBy: 'host' }),
      makeCard({ id: 1, flippedBy: 'guest' }),
      makeCard({ id: 2, flippedBy: 'host' }),
      makeCard({ id: 3 }),
    ];

    expect(getPlayerFlippedIndices(cards, 'host')).toEqual([0, 2]);
    expect(getPlayerFlippedIndices(cards, 'guest')).toEqual([1]);
  });

  it('blocks invalid flip scenarios and allows valid ones', () => {
    const cards: MemoryCard[] = [
      makeCard({ id: 0 }),
      makeCard({ id: 1, flippedBy: 'host' }),
      makeCard({ id: 2, matchedBy: 'guest' }),
      makeCard({ id: 3, flippedBy: 'host' }),
    ];

    expect(canFlipCard({
      cards,
      index: 0,
      username: 'host',
      done: true,
      isReady: true,
      resolvingMatch: false,
      locked: false,
    })).toBe(false);

    expect(canFlipCard({
      cards,
      index: 0,
      username: 'host',
      done: false,
      isReady: false,
      resolvingMatch: false,
      locked: false,
    })).toBe(false);

    expect(canFlipCard({
      cards,
      index: 0,
      username: 'host',
      done: false,
      isReady: true,
      resolvingMatch: true,
      locked: false,
    })).toBe(false);

    expect(canFlipCard({
      cards,
      index: 0,
      username: 'host',
      done: false,
      isReady: true,
      resolvingMatch: false,
      locked: true,
    })).toBe(false);

    expect(canFlipCard({
      cards,
      index: 1,
      username: 'guest',
      done: false,
      isReady: true,
      resolvingMatch: false,
      locked: false,
    })).toBe(false);

    expect(canFlipCard({
      cards,
      index: 2,
      username: 'guest',
      done: false,
      isReady: true,
      resolvingMatch: false,
      locked: false,
    })).toBe(false);

    expect(canFlipCard({
      cards,
      index: 0,
      username: 'host',
      done: false,
      isReady: true,
      resolvingMatch: false,
      locked: false,
    })).toBe(false);

    const validCards = [
      makeCard({ id: 0 }),
      makeCard({ id: 1, flippedBy: 'guest' }),
    ];

    expect(canFlipCard({
      cards: validCards,
      index: 0,
      username: 'host',
      done: false,
      isReady: true,
      resolvingMatch: false,
      locked: false,
    })).toBe(true);
  });

  it('picks two unmatched cards and returns null when fewer than two remain', () => {
    const cards: MemoryCard[] = [
      makeCard({ id: 0, matchedBy: 'host' }),
      makeCard({ id: 1 }),
      makeCard({ id: 2 }),
      makeCard({ id: 3, matchedBy: 'guest' }),
    ];

    expect(pickBotPair(cards, () => 0)).toEqual([1, 2]);

    expect(
      pickBotPair(
        [makeCard({ id: 0, matchedBy: 'host' }), makeCard({ id: 1 })],
        () => 0
      )
    ).toBeNull();
  });
});
