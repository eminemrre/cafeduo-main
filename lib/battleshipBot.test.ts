import { chooseBotShot } from './battleshipBot';
import { randomLayout, validateLayout } from './battleship';

const first = () => 0;

describe('chooseBotShot', () => {
  it('hunts on the checkerboard when nothing is hit', () => {
    for (let i = 0; i < 50; i += 1) {
      const cell = chooseBotShot([], [], (max) => Math.floor(Math.random() * max))!;
      expect((Math.floor(cell / 8) + (cell % 8)) % 2).toBe(0);
    }
  });

  it('shoots next to an unresolved hit', () => {
    const cell = chooseBotShot([{ cell: 27, hit: true }], [], first);
    expect([19, 35, 26, 28]).toContain(cell);
  });

  it('extends a line of two hits instead of trying the sides', () => {
    const shots = [
      { cell: 27, hit: true },
      { cell: 28, hit: true },
    ];
    for (const pickIndex of [0, 1]) {
      expect([26, 29]).toContain(chooseBotShot(shots, [], () => pickIndex));
    }
  });

  it('does not wrap a horizontal line onto the next row', () => {
    const shots = [
      { cell: 6, hit: true },
      { cell: 7, hit: true },
      { cell: 5, hit: false },
    ];
    // 8 is row 2; the line can only end at 5 (already shot), so it falls back to neighbours.
    expect([14, 15]).toContain(chooseBotShot(shots, [], first));
  });

  it('ignores hits that belong to a sunk ship', () => {
    const shots = [
      { cell: 0, hit: true },
      { cell: 1, hit: true },
    ];
    const cell = chooseBotShot(shots, [{ cells: [0, 1] }], first)!;
    expect([0, 1]).not.toContain(cell);
    expect((Math.floor(cell / 8) + (cell % 8)) % 2).toBe(0);
  });

  it('never repeats a cell and returns null on a full board', () => {
    const shots = Array.from({ length: 64 }, (_, cell) => ({ cell, hit: false }));
    expect(chooseBotShot(shots, [], first)).toBeNull();
  });

  it('sinks a whole random fleet well within the 64 cells', () => {
    const random = (max: number) => Math.floor(Math.random() * max);
    for (let game = 0; game < 20; game += 1) {
      const fleet = validateLayout(randomLayout(random));
      if (!fleet.ok) throw new Error('invalid layout');
      const ships = fleet.ships;
      const shots: { cell: number; hit: boolean }[] = [];
      const sunk: { cells: number[] }[] = [];
      while (sunk.length < ships.length) {
        const cell = chooseBotShot(shots, sunk, random);
        expect(cell).not.toBeNull();
        expect(shots.some((shot) => shot.cell === cell)).toBe(false);
        const ship = ships.find((candidate) => candidate.cells.includes(cell!));
        shots.push({ cell: cell!, hit: Boolean(ship) });
        if (ship && ship.cells.every((c) => shots.some((s) => s.cell === c && s.hit))) {
          sunk.push({ cells: ship.cells });
        }
      }
      expect(shots.length).toBeLessThan(64);
    }
  });
});
