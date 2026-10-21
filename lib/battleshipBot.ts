/**
 * Practice opponent for Amiral Battı. Unranked and local: it never talks to
 * the server, never sees the player's fleet and only reads the same public
 * board a human opponent would (its own shots and the sunk shapes).
 *
 * Hunt, then target: while a hit is unresolved it shoots next to it (along
 * the line once two hits line up); otherwise it hunts on a checkerboard, since
 * the smallest ship covers two cells.
 */
import { BOARD_SIZE, CELL_COUNT } from './battleship';

export interface BotShot {
  cell: number;
  hit: boolean;
}

const rowOf = (cell: number) => Math.floor(cell / BOARD_SIZE);
const colOf = (cell: number) => cell % BOARD_SIZE;

const neighbours = (cell: number): number[] => {
  const out: number[] = [];
  if (rowOf(cell) > 0) out.push(cell - BOARD_SIZE);
  if (rowOf(cell) < BOARD_SIZE - 1) out.push(cell + BOARD_SIZE);
  if (colOf(cell) > 0) out.push(cell - 1);
  if (colOf(cell) < BOARD_SIZE - 1) out.push(cell + 1);
  return out;
};

const pick = (cells: number[], randomInt: (max: number) => number) =>
  cells[randomInt(cells.length)];

/** Next cell for the bot; null only when every cell was already shot. */
export const chooseBotShot = (
  shots: BotShot[],
  sunk: { cells: number[] }[],
  randomInt: (max: number) => number = (max) => Math.floor(Math.random() * max)
): number | null => {
  const shot = new Set(shots.map((entry) => entry.cell));
  const sunkCells = new Set(sunk.flatMap((ship) => ship.cells));
  const open = (cell: number) => !shot.has(cell);
  const unresolved = shots
    .filter((entry) => entry.hit && !sunkCells.has(entry.cell))
    .map((entry) => entry.cell);

  if (unresolved.length >= 2) {
    // Two or more live hits on one row or column: extend that line first.
    for (const a of unresolved) {
      for (const b of unresolved) {
        if (a >= b) continue;
        const sameRow = rowOf(a) === rowOf(b);
        const sameCol = colOf(a) === colOf(b);
        if (!sameRow && !sameCol) continue;
        const line = unresolved
          .filter((cell) => (sameRow ? rowOf(cell) === rowOf(a) : colOf(cell) === colOf(a)))
          .sort((x, y) => x - y);
        const step = sameRow ? 1 : BOARD_SIZE;
        const ends = [line[0] - step, line[line.length - 1] + step].filter(
          (cell) =>
            cell >= 0 &&
            cell < CELL_COUNT &&
            (sameRow ? rowOf(cell) === rowOf(a) : true) &&
            open(cell)
        );
        if (ends.length) return pick(ends, randomInt);
      }
    }
  }

  if (unresolved.length) {
    const around = [...new Set(unresolved.flatMap(neighbours))].filter(open);
    if (around.length) return pick(around, randomInt);
  }

  const all = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(open);
  if (!all.length) return null;
  const parity = all.filter((cell) => (rowOf(cell) + colOf(cell)) % 2 === 0);
  return pick(parity.length ? parity : all, randomInt);
};
