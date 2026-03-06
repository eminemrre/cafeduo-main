export interface MemoryCard {
  id: number;
  emoji: string;
  flippedBy: string | null;
  matchedBy: string | null;
}

export interface CanFlipCardParams {
  cards: MemoryCard[];
  index: number;
  username: string;
  done: boolean;
  isReady: boolean;
  resolvingMatch: boolean;
  locked: boolean;
}

const MEMORY_DUEL_EMOJIS = ['🚀', '🛸', '👾', '🎮', '⚡', '🔮', '🎲', '🏆'];

const shuffle = <T,>(items: T[], randomFn: () => number): T[] =>
  items
    .map((item, index) => ({ item, key: randomFn(), index }))
    .sort((left, right) => {
      if (left.key === right.key) {
        return left.index - right.index;
      }
      return left.key - right.key;
    })
    .map(({ item }) => item);

export const buildMemoryDeck = (randomFn: () => number = Math.random): MemoryCard[] =>
  shuffle([...MEMORY_DUEL_EMOJIS, ...MEMORY_DUEL_EMOJIS], randomFn).map((emoji, id) => ({
    id,
    emoji,
    flippedBy: null,
    matchedBy: null,
  }));

export const getPlayerFlippedIndices = (cards: MemoryCard[], username: string): number[] =>
  cards.reduce<number[]>((indices, card, index) => {
    if (card.flippedBy === username) {
      indices.push(index);
    }
    return indices;
  }, []);

export const canFlipCard = ({
  cards,
  index,
  username,
  done,
  isReady,
  resolvingMatch,
  locked,
}: CanFlipCardParams): boolean => {
  if (done || !isReady || resolvingMatch || locked) return false;

  const card = cards[index];
  if (!card) return false;
  if (card.flippedBy || card.matchedBy) return false;

  return getPlayerFlippedIndices(cards, username).length < 2;
};

export const pickBotPair = (
  cards: MemoryCard[],
  randomFn: () => number = Math.random
): [number, number] | null => {
  const unmatchedIndices = cards
    .map((card, index) => (card.matchedBy === null ? index : -1))
    .filter((index) => index !== -1);

  if (unmatchedIndices.length < 2) return null;

  const [first, second] = shuffle(unmatchedIndices, randomFn);
  if (first === undefined || second === undefined || first === second) {
    return null;
  }

  return [first, second];
};
