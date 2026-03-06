export type TileColor = 'kirmizi' | 'mavi' | 'sari' | 'siyah';
export type OkeyTurnOwner = 'host' | 'guest';

export interface OkeyTile {
  id: string;
  color: TileColor;
  value: number;
}

export interface OkeyState {
  deck: OkeyTile[];
  discardPile: OkeyTile[];
  hostHand: OkeyTile[];
  guestHand: OkeyTile[];
  turn: OkeyTurnOwner;
  mustDraw: boolean;
  finished: boolean;
  winner: string | null;
  message: string;
  hostName: string;
  guestName: string;
}

export const TILE_COLORS: TileColor[] = ['kirmizi', 'mavi', 'sari', 'siyah'];

export const TILE_STYLE: Record<TileColor, string> = {
  kirmizi: 'border-rose-300/90 bg-rose-600/35',
  mavi: 'border-cyan-300/90 bg-cyan-600/35',
  sari: 'border-amber-200/90 bg-amber-500/40 text-[#071021]',
  siyah: 'border-slate-300/90 bg-slate-800/80',
};

export const shuffle = <T,>(input: T[]): T[] => {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const createTileDeck = (): OkeyTile[] => {
  const deck: OkeyTile[] = [];
  for (let setIndex = 0; setIndex < 2; setIndex += 1) {
    for (const color of TILE_COLORS) {
      for (let value = 1; value <= 13; value += 1) {
        deck.push({
          id: `${setIndex}-${color}-${value}-${Math.random().toString(36).slice(2, 7)}`,
          color,
          value,
        });
      }
    }
  }
  return shuffle(deck);
};

export const countColorRuns = (tiles: OkeyTile[]): number => {
  let runs = 0;
  for (const color of TILE_COLORS) {
    const values = tiles
      .filter((tile) => tile.color === color)
      .map((tile) => tile.value)
      .sort((a, b) => a - b);
    let streak = 1;
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] === values[i - 1] + 1) {
        streak += 1;
      } else if (values[i] !== values[i - 1]) {
        if (streak >= 3) runs += 1;
        streak = 1;
      }
    }
    if (streak >= 3) runs += 1;
  }
  return runs;
};

export const countSameValueSets = (tiles: OkeyTile[]): number => {
  const byValue = new Map<number, Set<TileColor>>();
  for (const tile of tiles) {
    if (!byValue.has(tile.value)) byValue.set(tile.value, new Set());
    byValue.get(tile.value)?.add(tile.color);
  }
  let sets = 0;
  for (const colors of byValue.values()) {
    if (colors.size >= 3) sets += 1;
  }
  return sets;
};

export const calcMeldScore = (tiles: OkeyTile[]): number => countColorRuns(tiles) + countSameValueSets(tiles);

export const hasWinningShape = (tiles: OkeyTile[]): boolean => calcMeldScore(tiles) >= 3;

export const initOkeyState = (hostName: string, guestName: string): OkeyState => {
  const deck = createTileDeck();
  const hostHand = deck.slice(0, 14);
  const guestHand = deck.slice(14, 28);
  const discard = deck[28];
  return {
    deck: deck.slice(29),
    discardPile: [discard],
    hostHand,
    guestHand,
    turn: 'host',
    mustDraw: true,
    finished: false,
    winner: null,
    message: 'Taş çek ve bir taş at.',
    hostName,
    guestName,
  };
};

export const drawFromDeck = (state: OkeyState): { nextState: OkeyState; tile: OkeyTile | null } => {
  if (!state.deck.length) return { nextState: state, tile: null };
  const nextTile = state.deck[0];
  return {
    tile: nextTile,
    nextState: { ...state, deck: state.deck.slice(1) },
  };
};
