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

export const BOARD_SIZE: number;
export const CELL_COUNT: number;
export const DIRECTIONS: readonly ShipDirection[];
export const FLEET: readonly number[];
export const FLEET_CELLS: number;
export const MAX_BATTLE_TURNS: number;
export const MAX_MISSED_TURNS: number;
export const PLACEMENT_MS: number;
export const TURN_MS: number;

export function cellName(cell: number): string;
export function isCell(value: unknown): boolean;
export function randomLayout(randomInt: (max: number) => number): LayoutEntry[];
export function shipCells(cell: number, dir: unknown, size: number): number[] | null;
export function validateLayout(layout: unknown): LayoutValidation;
