export type UnoColor = 'red' | 'blue' | 'green' | 'yellow';
export type UnoTurnOwner = 'host' | 'guest';

export interface UnoCard {
  id: string;
  color: UnoColor;
  number: number;
}

export interface UnoState {
  deck: UnoCard[];
  discard: UnoCard[];
  hostHand: UnoCard[];
  guestHand: UnoCard[];
  turn: UnoTurnOwner;
  message: string;
  finished: boolean;
  winner: string | null;
  hostName: string;
  guestName: string;
}

export const UNO_COLORS: UnoColor[] = ['red', 'blue', 'green', 'yellow'];

export const COLOR_STYLES: Record<UnoColor, string> = {
  red: 'bg-rose-600/90 border-rose-200/80',
  blue: 'bg-cyan-600/90 border-cyan-200/80',
  green: 'bg-emerald-600/90 border-emerald-200/80',
  yellow: 'bg-amber-500/90 border-amber-100/90 text-[#0a1223]',
};

export const shuffle = <T,>(input: T[]): T[] => {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const makeDeck = (): UnoCard[] => {
  const cards: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    for (let n = 0; n <= 9; n += 1) {
      cards.push({ id: `${color}-${n}-a`, color, number: n });
      cards.push({ id: `${color}-${n}-b`, color, number: n });
    }
  }
  return shuffle(cards);
};

export const canPlay = (candidate: UnoCard, topCard: UnoCard): boolean =>
  candidate.color === topCard.color || candidate.number === topCard.number;

export const drawOne = (state: UnoState): { nextState: UnoState; card: UnoCard | null } => {
  let deck = state.deck.slice();
  let discard = state.discard.slice();
  if (!deck.length && discard.length > 1) {
    const top = discard[discard.length - 1];
    const recyclable = discard.slice(0, -1);
    deck = shuffle(recyclable);
    discard = [top];
  }
  if (!deck.length) {
    return { nextState: { ...state, deck, discard }, card: null };
  }
  const card = deck[0];
  return {
    card,
    nextState: { ...state, deck: deck.slice(1), discard },
  };
};

export const initUnoState = (hostName: string, guestName: string): UnoState => {
  const deck = makeDeck();
  const hostHand = deck.slice(0, 7);
  const guestHand = deck.slice(7, 14);
  const starter = deck[14];
  const rest = deck.slice(15);

  return {
    deck: rest,
    discard: [starter],
    hostHand,
    guestHand,
    turn: 'host',
    message: 'Kartını seç ve oyna.',
    finished: false,
    winner: null,
    hostName,
    guestName,
  };
};
