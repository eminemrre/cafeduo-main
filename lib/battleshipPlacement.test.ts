import { FLEET, shipCells } from './battleship';
import { placeCovering, rotateInPlace, shipAt, type Draft } from './battleshipPlacement';

const empty = (): Draft => FLEET.map((): null => null);
const cellsOf = (draft: Draft, index: number) => {
  const entry = draft[index];
  return entry ? shipCells(entry.cell, entry.dir, FLEET[index]) : null;
};

describe('placeCovering', () => {
  it('starts the ship on the tapped cell when it fits', () => {
    const next = placeCovering(empty(), 0, 10, 'h');
    expect(cellsOf(next!, 0)).toEqual([10, 11, 12, 13]);
  });

  it('slides back along the row so the tapped cell stays part of the ship', () => {
    // G1 (6): a 4-ship cannot start there, E1-H1 still covers G1.
    expect(cellsOf(placeCovering(empty(), 0, 6, 'h')!, 0)).toEqual([4, 5, 6, 7]);
  });

  it('slides past a neighbour instead of refusing the tap', () => {
    const withFour = placeCovering(empty(), 0, 4, 'h')!; // E1-H1
    // D1 (3): D1-F1 would overlap; B1-D1 is free and covers D1.
    expect(cellsOf(placeCovering(withFour, 1, 3, 'h')!, 1)).toEqual([1, 2, 3]);
  });

  it('turns the ship when no position in the chosen direction covers the cell', () => {
    // Row 1: ship 0 on A1-D1, ship 1 on F1-H1. Only E1 is free in that row.
    const draft: Draft = [{ cell: 0, dir: 'h' }, { cell: 5, dir: 'h' }, null, null];
    const next = placeCovering(draft, 3, 4, 'h');
    expect(cellsOf(next!, 3)).toEqual([4, 12]);
    expect(next![3]!.dir).toBe('v');
  });

  it('moves an already placed ship without colliding with itself', () => {
    const placed = placeCovering(empty(), 0, 0, 'h')!; // A1-D1
    expect(cellsOf(placeCovering(placed, 0, 1, 'h')!, 0)).toEqual([1, 2, 3, 4]);
  });

  it('returns null only when no position in either direction covers the cell', () => {
    // E1 (4) boxed in: D1 and F1 taken horizontally, E2 taken below.
    const draft: Draft = [{ cell: 0, dir: 'h' }, { cell: 5, dir: 'h' }, { cell: 12, dir: 'h' }, null];
    expect(placeCovering(draft, 3, 4, 'h')).toBeNull();
  });
});

describe('rotateInPlace', () => {
  it('turns a placed ship around its bow', () => {
    const placed = placeCovering(empty(), 0, 0, 'h')!;
    expect(cellsOf(rotateInPlace(placed, 0)!, 0)).toEqual([0, 8, 16, 24]);
  });

  it('keeps the bow on the board when the turned ship would run off the edge', () => {
    const placed = placeCovering(empty(), 3, 58, 'h')!; // C8-D8
    expect(cellsOf(rotateInPlace(placed, 3)!, 3)).toEqual([50, 58]);
  });

  it('refuses a turn with no free position and leaves an unplaced ship alone', () => {
    const draft: Draft = [{ cell: 0, dir: 'h' }, { cell: 8, dir: 'h' }, { cell: 16, dir: 'h' }, null];
    // Ship 1 (B row) cannot turn: every vertical spot through A2 hits ship 0 or 2.
    expect(rotateInPlace(draft, 1)).toBeNull();
    expect(rotateInPlace(draft, 3)).toBeNull();
  });
});

describe('shipAt', () => {
  it('finds which ship covers a cell', () => {
    const draft = placeCovering(empty(), 2, 20, 'v')!;
    expect(shipAt(draft, 28)).toBe(2);
    expect(shipAt(draft, 21)).toBe(-1);
  });
});
