/**
 * Shared Amiral Battı rules: the board, the fleet and layout validation.
 *
 * The server validates every layout and decides every shot; the client uses
 * the same functions to preview a placement and to run the unranked practice
 * bot. Nothing here knows where an opponent's ships are.
 *
 * Loaded by both runtimes the same way as `aimTrajectory.js`: CommonJS for the
 * backend, a private global for Vite (`lib/battleship.ts`).
 */
(function publishBattleship(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__CAFEDUO_BATTLESHIP__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBattleship() {
  const BOARD_SIZE = 8;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
  /** Ship sizes in fleet order; layout entry i places ship `s{i+1}`. */
  const FLEET = Object.freeze([4, 3, 3, 2]);
  const FLEET_CELLS = FLEET.reduce((sum, size) => sum + size, 0);
  const PLACEMENT_MS = 45_000;
  const TURN_MS = 20_000;
  const MAX_MISSED_TURNS = 3;
  /** Hard cap on battle turns, so a stalling pair cannot keep a match open forever. */
  const MAX_BATTLE_TURNS = 2 * CELL_COUNT;
  const DIRECTIONS = Object.freeze(['h', 'v']);

  const isCell = (value) => Number.isInteger(value) && value >= 0 && value < CELL_COUNT;

  /** Cells of a ship whose bow is `cell`, running right ('h') or down ('v'); null if off-board. */
  const shipCells = (cell, dir, size) => {
    if (!isCell(cell) || !Number.isInteger(size) || size < 1) return null;
    const row = Math.floor(cell / BOARD_SIZE);
    const col = cell % BOARD_SIZE;
    if (dir === 'h') {
      if (col + size > BOARD_SIZE) return null;
      return Array.from({ length: size }, (_, i) => cell + i);
    }
    if (dir === 'v') {
      if (row + size > BOARD_SIZE) return null;
      return Array.from({ length: size }, (_, i) => cell + i * BOARD_SIZE);
    }
    return null;
  };

  /**
   * @returns {{ok: true, ships: {id: string, size: number, cells: number[]}[]} |
   *           {ok: false, code: string, message: string}}
   */
  const validateLayout = (layout) => {
    if (!Array.isArray(layout) || layout.length !== FLEET.length) {
      return { ok: false, code: 'INVALID_LAYOUT', message: 'Filoda dört gemi olmalı.' };
    }
    const used = new Set();
    const ships = [];
    for (let index = 0; index < FLEET.length; index += 1) {
      const entry = layout[index];
      const size = FLEET[index];
      const cells = shipCells(entry?.cell, entry?.dir, size);
      if (!cells) {
        return { ok: false, code: 'INVALID_LAYOUT', message: 'Bir gemi tahtanın dışına taşıyor.' };
      }
      if (cells.some((cell) => used.has(cell))) {
        return { ok: false, code: 'SHIPS_OVERLAP', message: 'Gemiler üst üste binemez.' };
      }
      cells.forEach((cell) => used.add(cell));
      ships.push({ id: `s${index + 1}`, size, cells });
    }
    return { ok: true, ships };
  };

  /**
   * A valid random layout from an integer source (`randomInt(max)` returns
   * 0..max-1). The server passes crypto randomness, the practice bot Math.random.
   */
  const randomLayout = (randomInt) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const used = new Set();
      const layout = [];
      for (const size of FLEET) {
        let placed = null;
        for (let tries = 0; tries < 100 && !placed; tries += 1) {
          const dir = DIRECTIONS[randomInt(2)];
          const cell = randomInt(CELL_COUNT);
          const cells = shipCells(cell, dir, size);
          if (cells && !cells.some((c) => used.has(c))) placed = { cell, dir, cells };
        }
        if (!placed) break;
        placed.cells.forEach((c) => used.add(c));
        layout.push({ cell: placed.cell, dir: placed.dir });
      }
      if (layout.length === FLEET.length) return layout;
    }
    throw new Error('Could not generate a battleship layout');
  };

  /** "A1".."H8": column letter, row number, for labels and screen readers. */
  const cellName = (cell) =>
    isCell(cell) ? `${'ABCDEFGH'[cell % BOARD_SIZE]}${Math.floor(cell / BOARD_SIZE) + 1}` : '';

  return {
    BOARD_SIZE,
    CELL_COUNT,
    DIRECTIONS,
    FLEET,
    FLEET_CELLS,
    MAX_BATTLE_TURNS,
    MAX_MISSED_TURNS,
    PLACEMENT_MS,
    TURN_MS,
    cellName,
    isCell,
    randomLayout,
    shipCells,
    validateLayout,
  };
});
