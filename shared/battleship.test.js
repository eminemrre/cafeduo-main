const {
  BOARD_SIZE,
  CELL_COUNT,
  FLEET,
  FLEET_CELLS,
  cellName,
  randomLayout,
  shipCells,
  validateLayout,
} = require('./battleship');

const LAYOUT = [
  { cell: 0, dir: 'h' }, // A1-D1
  { cell: 16, dir: 'v' }, // A3-A5
  { cell: 21, dir: 'h' }, // F3-H3
  { cell: 63 - 8, dir: 'v' }, // H7-H8
];

describe('shared battleship rules', () => {
  it('uses an 8x8 board and the approved 4+3+3+2 fleet', () => {
    expect(BOARD_SIZE).toBe(8);
    expect(CELL_COUNT).toBe(64);
    expect(FLEET).toEqual([4, 3, 3, 2]);
    expect(FLEET_CELLS).toBe(12);
  });

  it('lays ships right or down and refuses to wrap off the board', () => {
    expect(shipCells(0, 'h', 4)).toEqual([0, 1, 2, 3]);
    expect(shipCells(4, 'h', 4)).toEqual([4, 5, 6, 7]);
    expect(shipCells(5, 'h', 4)).toBeNull();
    expect(shipCells(40, 'v', 3)).toEqual([40, 48, 56]);
    expect(shipCells(48, 'v', 3)).toBeNull();
    expect(shipCells(0, 'x', 2)).toBeNull();
    expect(shipCells(64, 'h', 2)).toBeNull();
    expect(shipCells(1.5, 'h', 2)).toBeNull();
  });

  it('accepts a valid layout and names the ships in fleet order', () => {
    const result = validateLayout(LAYOUT);
    expect(result.ok).toBe(true);
    expect(result.ships).toEqual([
      { id: 's1', size: 4, cells: [0, 1, 2, 3] },
      { id: 's2', size: 3, cells: [16, 24, 32] },
      { id: 's3', size: 3, cells: [21, 22, 23] },
      { id: 's4', size: 2, cells: [55, 63] },
    ]);
  });

  it('allows touching ships but rejects overlaps, wrong counts and off-board ships', () => {
    expect(validateLayout([...LAYOUT.slice(0, 3), { cell: 4, dir: 'h' }]).ok).toBe(true);
    expect(validateLayout([...LAYOUT.slice(0, 3), { cell: 3, dir: 'v' }])).toMatchObject({
      ok: false,
      code: 'SHIPS_OVERLAP',
    });
    expect(validateLayout(LAYOUT.slice(0, 3))).toMatchObject({ ok: false, code: 'INVALID_LAYOUT' });
    expect(validateLayout([...LAYOUT, { cell: 40, dir: 'h' }])).toMatchObject({ ok: false });
    expect(validateLayout([{ cell: 6, dir: 'h' }, ...LAYOUT.slice(1)])).toMatchObject({
      ok: false,
      code: 'INVALID_LAYOUT',
    });
    expect(validateLayout(null)).toMatchObject({ ok: false });
    expect(validateLayout('A1')).toMatchObject({ ok: false });
  });

  it('generates valid random layouts from integer randomness only', () => {
    let seed = 7;
    const randomInt = (max) => {
      expect(Number.isInteger(max) && max > 0).toBe(true);
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };
    for (let i = 0; i < 200; i += 1) {
      expect(validateLayout(randomLayout(randomInt)).ok).toBe(true);
    }
    // A source that never varies cannot place a second ship; it must fail loudly.
    expect(() => randomLayout(() => 0)).toThrow('Could not generate a battleship layout');
  });

  it('names cells by column letter and row number', () => {
    expect(cellName(0)).toBe('A1');
    expect(cellName(7)).toBe('H1');
    expect(cellName(63)).toBe('H8');
    expect(cellName(64)).toBe('');
  });
});
