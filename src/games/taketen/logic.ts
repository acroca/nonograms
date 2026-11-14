/**
 * Take Ten: a sheet of digits read like text, nine to a line. Two numbers can be crossed out together when they are
 * equal or add up to 10 and nothing but crossed-out numbers lies between them: along a column, along a diagonal, or
 * in reading order (so the end of one line continues at the start of the next). A line with every number crossed out
 * disappears. The aim is to cross out everything.
 *
 * Unlike the other games there is no single solution to find. Instead every generated sheet is built backwards from
 * a full sequence of moves, so it can always be cleared without adding numbers.
 */
import { mulberry32, randInt, type Rng } from '../../core/rng';

export const COLS = 9;

export interface TakeTenPuzzle {
  /** Number of full lines at the start. */
  rows: number;
  /** Row-major digits 1..9. */
  cells: number[];
  /**
   * One way to clear the sheet: the pair to cross out at each step, as positions in the sheet as it is at that step
   * (cleared lines having been dropped).
   */
  solution: [number, number][];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '4', label: '4 rows' },
  { id: '6', label: '6 rows' },
  { id: '8', label: '8 rows' },
];
export const DEFAULT_VARIANT = '6';

/**
 * A sheet in play is a row-major list of numbers: positive while still there, negated once crossed out. The last
 * line may be shorter than the others.
 */
export type Sheet = number[];

export const isLive = (cells: Sheet, i: number) => cells[i] > 0;

export const remaining = (cells: Sheet) => cells.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);

export const matches = (a: number, b: number) => a === b || a + b === 10;

/** Steps to the next square along each line a pair can lie on: reading order, column and the two diagonals. */
const STEPS = [1, COLS, COLS + 1, COLS - 1];

/** The first number still on the sheet after `a` in direction `step`, or -1. */
function nextLive(cells: Sheet, a: number, step: number): number {
  const dc = step === 1 ? 0 : step - COLS;
  let col = a % COLS;
  for (let i = a + step; i < cells.length; i += step) {
    if (step !== 1) {
      col += dc;
      if (col < 0 || col >= COLS) return -1;
    }
    if (cells[i] > 0) return i;
  }
  return -1;
}

/** The numbers after `a` that it has a clear line to, whatever their values. */
export function partners(cells: Sheet, a: number): number[] {
  const out: number[] = [];
  if (!isLive(cells, a)) return out;
  for (const step of STEPS) {
    const b = nextLive(cells, a, step);
    if (b >= 0 && !out.includes(b)) out.push(b);
  }
  return out;
}

/** Whether the numbers at `a` and `b` have a clear line between them. */
export function linked(cells: Sheet, a: number, b: number): boolean {
  if (a === b) return false;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return partners(cells, lo).includes(hi);
}

/** Whether `a` and `b` can be crossed out together. */
export function canPair(cells: Sheet, a: number, b: number): boolean {
  return isLive(cells, a) && isLive(cells, b) && matches(cells[a], cells[b]) && linked(cells, a, b);
}

/** Drops every line that has nothing left on it. */
function dropClearedRows(cells: Sheet): Sheet {
  const out: Sheet = [];
  for (let start = 0; start < cells.length; start += COLS) {
    const row = cells.slice(start, start + COLS);
    if (row.some((v) => v > 0)) out.push(...row);
  }
  return out;
}

/** The sheet after crossing out `a` and `b`. Does not check that the move is legal. */
export function clearPair(cells: Sheet, a: number, b: number): Sheet {
  const next = cells.slice();
  next[a] = -Math.abs(next[a]);
  next[b] = -Math.abs(next[b]);
  return dropClearedRows(next);
}

/** The sheet after copying every number still on it to the end, in reading order. */
export function addNumbers(cells: Sheet): Sheet {
  return cells.concat(cells.filter((v) => v > 0));
}

/** Some pair that can be crossed out, or null when there is none. */
export function findPair(cells: Sheet): [number, number] | null {
  for (let a = 0; a < cells.length; a++) {
    for (const b of partners(cells, a)) if (matches(cells[a], cells[b])) return [a, b];
  }
  return null;
}

/** Plays `moves` from a fresh sheet; returns the final sheet, or null if a move was illegal. */
export function replay(start: Sheet, moves: [number, number][]): Sheet | null {
  let cells = start.slice();
  for (const [a, b] of moves) {
    if (!canPair(cells, a, b)) return null;
    cells = clearPair(cells, a, b);
  }
  return cells;
}

/** How many pairs can be crossed out on a sheet right now. */
export function countPairs(cells: Sheet): number {
  let n = 0;
  for (let a = 0; a < cells.length; a++) {
    for (const b of partners(cells, a)) if (matches(cells[a], cells[b])) n++;
  }
  return n;
}

/** Squares that touch `id` on the untouched sheet: its eight neighbours plus the reading-order wrap. */
function startNeighbours(id: number, total: number): number[] {
  const r = Math.floor(id / COLS);
  const c = id % COLS;
  const out = new Set<number>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const [rr, cc] = [r + dr, c + dc];
      if ((dr || dc) && rr >= 0 && cc >= 0 && cc < COLS && rr * COLS + cc < total) out.add(rr * COLS + cc);
    }
  }
  if (id > 0) out.add(id - 1);
  if (id + 1 < total) out.add(id + 1);
  return [...out];
}

/** How often the generator takes a pair that only opens up once other numbers are gone, when one exists. */
const FAR_BIAS = 0.75;
/** Digit pairs tried for each move; the one adding fewest ready-made pairs to the starting sheet is kept. */
const VALUE_TRIES = 5;

function build(rows: number, rng: Rng): Pick<TakeTenPuzzle, 'cells' | 'solution'> {
  const total = rows * COLS;
  const values = new Array<number>(total).fill(0);
  // Play a whole game on a sheet of blanks, deciding the two digits of each pair as it is crossed out. Whether two
  // squares have a clear line depends only on which squares are left, so the finished sheet replays the same way.
  // The sheet holds square ids (+1, so they are positive) in place of digits.
  let sheet: Sheet = Array.from({ length: total }, (_, i) => i + 1);
  const solution: [number, number][] = [];
  const neighbours = Array.from({ length: total }, (_, id) => startNeighbours(id, total));
  while (sheet.length) {
    const near: [number, number][] = [];
    const far: [number, number][] = [];
    for (let a = 0; a < sheet.length; a++) {
      for (const b of partners(sheet, a)) {
        const touching = neighbours[sheet[a] - 1].includes(sheet[b] - 1);
        (touching ? near : far).push([a, b]);
      }
    }
    const pool = far.length && (!near.length || rng() < FAR_BIAS) ? far : near;
    const [a, b] = pool[randInt(rng, pool.length)];
    const [ia, ib] = [sheet[a] - 1, sheet[b] - 1];
    // Count the pairs a digit would form with the neighbours already decided.
    const clashes = (id: number, v: number, other: number) =>
      neighbours[id].reduce((n, k) => n + (k !== other && values[k] && matches(values[k], v) ? 1 : 0), 0);
    let best: [number, number] = [0, 0];
    let bestScore = Infinity;
    for (let k = 0; k < VALUE_TRIES; k++) {
      const va = 1 + randInt(rng, 9);
      const vb = rng() < 0.5 ? va : 10 - va;
      const score = clashes(ia, va, ib) + clashes(ib, vb, ia);
      if (score < bestScore) [best, bestScore] = [[va, vb], score];
    }
    [values[ia], values[ib]] = best;
    solution.push([a, b]);
    sheet = clearPair(sheet, a, b);
  }
  return { cells: values, solution };
}

/** Builds a sheet that can be cleared completely. */
export function generate(variant: string, seed: number): TakeTenPuzzle {
  const v = VARIANTS.find((x) => x.id === variant) ?? VARIANTS.find((x) => x.id === DEFAULT_VARIANT)!;
  const rows = Number(v.id);
  const rng = mulberry32(seed);
  return { rows, ...build(rows, rng), variant: v.id, seed };
}
