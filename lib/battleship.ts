/**
 * Browser-side access to the Amiral Battı rules in `shared/battleship.js`
 * (same global bridge as `lib/aimTrajectory.ts`: the shared file is CommonJS
 * for the backend and cannot be a native ESM export for Vite at the same time).
 */
import '../shared/battleship';

export type ShipDirection = 'h' | 'v';

export interface LayoutEntry {
  cell: number;
  dir: ShipDirection;
}

export interface PlacedShip {
  id: string;
  size: number;
  cells: number[];
}

export type LayoutValidation =
  | { ok: true; ships: PlacedShip[] }
  | { ok: false; code: string; message: string };

interface BattleshipApi {
  BOARD_SIZE: number;
  CELL_COUNT: number;
  FLEET: readonly number[];
  FLEET_CELLS: number;
  MAX_MISSED_TURNS: number;
  PLACEMENT_MS: number;
  TURN_MS: number;
  cellName: (cell: number) => string;
  isCell: (value: unknown) => boolean;
  randomLayout: (randomInt: (max: number) => number) => LayoutEntry[];
  shipCells: (cell: number, dir: unknown, size: number) => number[] | null;
  validateLayout: (layout: unknown) => LayoutValidation;
}

const api = (globalThis as typeof globalThis & { __CAFEDUO_BATTLESHIP__?: BattleshipApi })
  .__CAFEDUO_BATTLESHIP__;

if (!api) {
  throw new Error('Battleship rules module failed to initialize.');
}

export const BOARD_SIZE = api.BOARD_SIZE;
export const CELL_COUNT = api.CELL_COUNT;
export const FLEET = api.FLEET;
export const FLEET_CELLS = api.FLEET_CELLS;
export const MAX_MISSED_TURNS = api.MAX_MISSED_TURNS;
export const PLACEMENT_MS = api.PLACEMENT_MS;
export const TURN_MS = api.TURN_MS;
export const cellName = api.cellName;
export const isCell = api.isCell;
export const randomLayout = api.randomLayout;
export const shipCells = api.shipCells;
export const validateLayout = api.validateLayout;
