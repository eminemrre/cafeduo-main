/**
 * Placement draft helpers for Amiral Battı. A tap always puts the ship on the
 * cell the player touched: the ship starts there if it fits, otherwise it
 * slides back along the row (or column) so it still covers that cell, and only
 * then tries the other direction. The shared `validateLayout` still checks the
 * final fleet.
 */
import { BOARD_SIZE, FLEET, shipCells, type LayoutEntry, type ShipDirection } from './battleship';

export type Draft = (LayoutEntry | null)[];

const other = (dir: ShipDirection): ShipDirection => (dir === 'h' ? 'v' : 'h');

const cellsOf = (draft: Draft, index: number) => {
  const entry = draft[index];
  return entry ? shipCells(entry.cell, entry.dir, FLEET[index]) || [] : [];
};

/** Index of the ship covering `cell`, or -1. */
export const shipAt = (draft: Draft, cell: number) =>
  draft.findIndex((_, index) => cellsOf(draft, index).includes(cell));

/** Bows (in preference order) of every position of `size` in `dir` that covers `cell`. */
const bowsCovering = (cell: number, dir: ShipDirection, size: number) => {
  const step = dir === 'h' ? 1 : BOARD_SIZE;
  const bows: number[] = [];
  for (let back = 0; back < size; back += 1) {
    const bow = cell - back * step;
    const cells = shipCells(bow, dir, size);
    if (cells && cells.includes(cell)) bows.push(bow);
  }
  return bows;
};

const fits = (draft: Draft, index: number, entry: LayoutEntry) => {
  const cells = shipCells(entry.cell, entry.dir, FLEET[index]);
  if (!cells) return false;
  return !draft.some((_, other) => other !== index && cellsOf(draft, other).some((c) => cells.includes(c)));
};

const firstFit = (draft: Draft, index: number, cell: number, dirs: ShipDirection[]) => {
  for (const dir of dirs) {
    for (const bow of bowsCovering(cell, dir, FLEET[index])) {
      const entry = { cell: bow, dir };
      if (fits(draft, index, entry)) return draft.map((e, i) => (i === index ? entry : e));
    }
  }
  return null;
};

/** Places (or moves) ship `index` so it covers `cell`; null when no position does. */
export const placeCovering = (draft: Draft, index: number, cell: number, dir: ShipDirection) =>
  firstFit(draft, index, cell, [dir, other(dir)]);

/** Turns a placed ship around its bow cell; null when it is unplaced or cannot turn. */
export const rotateInPlace = (draft: Draft, index: number) => {
  const entry = draft[index];
  if (!entry) return null;
  return firstFit(draft, index, entry.cell, [other(entry.dir)]);
};
