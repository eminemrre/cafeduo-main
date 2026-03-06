export type MonopolyOwner = 'host' | 'guest';
export type MonopolyTurnOwner = MonopolyOwner;

export interface BoardCell {
  id: number;
  name: string;
  cost: number;
  rent: number;
}

export interface PendingPurchase {
  owner: MonopolyOwner;
  tileId: number;
}

export interface MonopolyState {
  hostPos: number;
  guestPos: number;
  hostCash: number;
  guestCash: number;
  properties: Record<number, MonopolyOwner>;
  turn: MonopolyTurnOwner;
  turnCount: number;
  lastRoll: number;
  message: string;
  pendingPurchase: PendingPurchase | null;
  finished: boolean;
  winner: string | null;
  hostName: string;
  guestName: string;
}

export const BOARD: BoardCell[] = Array.from({ length: 20 }).map((_, index) => {
  if (index === 0) {
    return { id: 0, name: 'BAŞLANGIÇ', cost: 0, rent: 0 };
  }
  const cost = 120 + index * 22;
  return {
    id: index,
    name: `Sokak ${index}`,
    cost,
    rent: Math.floor(cost * 0.22),
  };
});

export const MAX_TURNS = 30;

export const initMonopolyState = (hostName: string, guestName: string): MonopolyState => ({
  hostPos: 0,
  guestPos: 0,
  hostCash: 1500,
  guestCash: 1500,
  properties: {},
  turn: 'host',
  turnCount: 0,
  lastRoll: 0,
  message: 'Zar atarak başla.',
  pendingPurchase: null,
  finished: false,
  winner: null,
  hostName,
  guestName,
});

export const rollDice = (): number => 1 + Math.floor(Math.random() * 6);

export const passStartBonus = (oldPos: number, newPos: number): number => (newPos < oldPos ? 200 : 0);

export const resolveWinnerByCash = (
  hostCash: number,
  guestCash: number,
  hostName: string,
  guestName: string
): string => {
  if (hostCash === guestCash) return 'Berabere';
  return hostCash > guestCash ? hostName : guestName;
};

export const settleMonopolyLanding = (
  base: MonopolyState,
  owner: MonopolyOwner,
  nextPos: number
): MonopolyState => {
  const tile = BOARD[nextPos];
  if (!tile || tile.id === 0) {
    return { ...base, message: `${owner === 'host' ? base.hostName : base.guestName} başlangıçtan geçti.` };
  }

  const existingOwner = base.properties[tile.id];
  if (!existingOwner) {
    const ownerCash = owner === 'host' ? base.hostCash : base.guestCash;
    if (ownerCash >= tile.cost) {
      return {
        ...base,
        pendingPurchase: { owner, tileId: tile.id },
        message: `${tile.name} boş. ${tile.cost} CP ile satın alabilirsin.`,
      };
    }
    return { ...base, message: `${tile.name} boş ama bütçe yetersiz.` };
  }

  if (existingOwner === owner) {
    return { ...base, message: `${tile.name} zaten sende.` };
  }

  const payerCash = owner === 'host' ? base.hostCash : base.guestCash;
  const payAmount = Math.min(tile.rent, Math.max(0, payerCash));
  const nextHostCash = owner === 'host' ? base.hostCash - payAmount : base.hostCash + payAmount;
  const nextGuestCash = owner === 'guest' ? base.guestCash - payAmount : base.guestCash + payAmount;

  return {
    ...base,
    hostCash: nextHostCash,
    guestCash: nextGuestCash,
    message: `${tile.name} kirası ödendi: ${payAmount} CP.`,
  };
};

export const maybeEndMonopolyState = (next: MonopolyState): MonopolyState => {
  if (next.hostCash <= 0) {
    return { ...next, finished: true, winner: next.guestName, message: `${next.hostName} bütçeyi bitirdi.` };
  }
  if (next.guestCash <= 0) {
    return { ...next, finished: true, winner: next.hostName, message: `${next.guestName} bütçeyi bitirdi.` };
  }
  if (next.turnCount >= MAX_TURNS) {
    const winner = resolveWinnerByCash(next.hostCash, next.guestCash, next.hostName, next.guestName);
    return { ...next, finished: true, winner, message: `Tur limiti bitti. Kazanan: ${winner}` };
  }
  return next;
};
