/**
 * Thermometers: fill each thermometer with "mercury" from its round bulb, contiguously, so that every row and column
 * contains the given number of filled cells.
 */
import { ANY, countBetween, fixpoint, gridNeighbours, NO, probe, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

export interface ThermometersPuzzle {
  size: number;
  /** Each thermometer lists its cells from the bulb to the tip. Together they cover the grid. */
  thermometers: number[][];
  rowCounts: number[];
  colCounts: number[];
  /** Row-major, true = filled. */
  solution: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '5', label: '5×5' },
  { id: '6', label: '6×6' },
  { id: '7', label: '7×7' },
  { id: '8', label: '8×8' },
];
export const DEFAULT_VARIANT = '6';

type Shape = Pick<ThermometersPuzzle, 'size' | 'thermometers' | 'rowCounts' | 'colCounts'>;

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const props: Propagator[] = [];
  for (let k = 0; k < n; k++) {
    props.push(countBetween(Array.from({ length: n }, (_, c) => k * n + c), p.rowCounts[k]));
    props.push(countBetween(Array.from({ length: n }, (_, r) => r * n + k), p.colCounts[k]));
  }
  // Mercury rises from the bulb without gaps.
  props.push((d) => {
    for (const cells of p.thermometers) {
      for (let k = 1; k < cells.length; k++) {
        if (d[cells[k]] === YES) d[cells[k - 1]] &= YES;
        if (d[cells[k - 1]] === NO) d[cells[k]] &= NO;
      }
    }
    return true;
  });
  return props;
}

const startDoms = (p: Shape): Doms => new Uint32Array(p.size * p.size).fill(ANY);

/** Checks that `grid` (true = filled) is a complete, valid solution. */
export function validate(p: Shape, grid: boolean[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  for (const cells of p.thermometers) {
    for (let k = 1; k < cells.length; k++) if (grid[cells[k]] && !grid[cells[k - 1]]) return false;
  }
  for (let k = 0; k < n; k++) {
    let row = 0;
    let col = 0;
    for (let m = 0; m < n; m++) {
      if (grid[k * n + m]) row++;
      if (grid[m * n + k]) col++;
    }
    if (row !== p.rowCounts[k] || col !== p.colCounts[k]) return false;
  }
  return true;
}

/**
 * Human-style solver (no guessing): row/column counts and the mercury rule, plus one-step lookahead.
 * `filled` marks the cells known to be filled.
 */
export function solveLogic(p: Shape, lookahead = true): { solved: boolean; filled: boolean[] } {
  const d = startDoms(p);
  const props = propagators(p);
  let ok = fixpoint(d, props);
  if (ok && lookahead && d.some((m) => m === ANY)) ok = probe(d, props);
  const filled = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate(p, filled), filled };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/** Random cover of the grid by thermometers (snaking paths of 2..maxLen cells; leftovers become single bulbs). */
function randomThermometers(rng: Rng, n: number, maxLen: number): number[][] {
  const o = gridNeighbours(n, n);
  const taken = new Array<boolean>(n * n).fill(false);
  const out: number[][] = [];
  for (const start of shuffle(rng, Array.from({ length: n * n }, (_, i) => i))) {
    if (taken[start]) continue;
    const target = 2 + randInt(rng, maxLen - 1);
    const cells = [start];
    taken[start] = true;
    while (cells.length < target) {
      const options = o[cells[cells.length - 1]].filter((j) => !taken[j]);
      if (options.length === 0) break;
      const next = options[randInt(rng, options.length)];
      taken[next] = true;
      cells.push(next);
    }
    out.push(cells);
  }
  return out;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): ThermometersPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const thermometers = randomThermometers(rng, n, n <= 6 ? 5 : 7);
    if (thermometers.some((t) => t.length < 2)) continue;
    const solution = new Array<boolean>(n * n).fill(false);
    for (const cells of thermometers) {
      const fill = randInt(rng, cells.length + 1);
      for (let k = 0; k < fill; k++) solution[cells[k]] = true;
    }
    const rowCounts = Array.from({ length: n }, (_, r) => solution.slice(r * n, r * n + n).filter(Boolean).length);
    const colCounts = Array.from({ length: n }, (_, c) => solution.filter((s, i) => s && i % n === c).length);
    const p: ThermometersPuzzle = { size: n, thermometers, rowCounts, colCounts, solution, variant: id, seed };
    const d = startDoms(p);
    if (!fixpoint(d, propagators(p)) || d.filter((m) => m === ANY).length > n * n * 0.5) continue;
    if (solveLogic(p).solved && countSolutions(p) === 1) return p;
  }
}
