/**
 * Light Up: place bulbs on white cells so that every white cell is lit (a bulb lights its own cell and shines along
 * its row and column until a wall), no bulb is lit by another, and every numbered wall has exactly that many bulbs on
 * its four orthogonal neighbours.
 */
import { ANY, countBetween, fixpoint, gridNeighbours, NO, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, shuffle } from '../../core/rng';

/** Clue values per cell: `WHITE` for a floor cell, `BLANK` for a wall without a number, 0..4 for a numbered wall. */
export const WHITE: number = -2;
export const BLANK: number = -1;

export interface LightUpPuzzle {
  size: number;
  clues: number[];
  /** Row-major, true = bulb. */
  solution: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '6', label: '6×6' },
  { id: '8', label: '8×8' },
  { id: '10', label: '10×10' },
];
export const DEFAULT_VARIANT = '8';

/** Cells lit by a bulb at `i` (itself included): along its row and column until a wall. */
export function sight(n: number, clues: ArrayLike<number>, i: number): number[] {
  const out = [i];
  const r = Math.floor(i / n);
  const c = i % n;
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n && clues[rr * n + cc] === WHITE; rr += dr, cc += dc) {
      out.push(rr * n + cc);
    }
  }
  return out;
}

type Shape = Pick<LightUpPuzzle, 'size' | 'clues'>;

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const o = gridNeighbours(n, n);
  const props: Propagator[] = [];
  const done = new Set<string>();
  for (let i = 0; i < n * n; i++) {
    if (p.clues[i] === WHITE) {
      const view = sight(n, p.clues, i);
      // Someone must light every white cell.
      props.push(countBetween(view, 1, view.length));
      // Two bulbs never see each other: at most one per straight run of white cells.
      for (const dir of [1, n]) {
        const run = view.filter((j) => (dir === 1 ? Math.floor(j / n) === Math.floor(i / n) : j % n === i % n));
        const key = Math.min(...run) + ':' + dir;
        if (run.length > 1 && !done.has(key)) {
          done.add(key);
          props.push(countBetween(run, 0, 1));
        }
      }
    } else if (p.clues[i] >= 0) {
      props.push(countBetween(o[i].filter((j) => p.clues[j] === WHITE), p.clues[i]));
    }
  }
  return props;
}

function startDoms(p: Shape): Doms {
  const d = new Uint32Array(p.size * p.size).fill(ANY);
  p.clues.forEach((c, i) => {
    if (c !== WHITE) d[i] = NO;
  });
  return d;
}

/** Checks that `grid` (true = bulb) is a complete, valid solution. */
export function validate(p: Shape, grid: boolean[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  const lit = new Array<number>(n * n).fill(0);
  for (let i = 0; i < n * n; i++) {
    if (!grid[i]) continue;
    if (p.clues[i] !== WHITE) return false;
    for (const j of sight(n, p.clues, i)) lit[j]++;
  }
  for (let i = 0; i < n * n; i++) {
    if (p.clues[i] === WHITE) {
      if (lit[i] === 0) return false;
      if (grid[i] && lit[i] > 1) return false;
    } else if (p.clues[i] >= 0) {
      const r = Math.floor(i / n);
      const c = i % n;
      let bulbs = 0;
      if (r > 0 && grid[i - n]) bulbs++;
      if (r < n - 1 && grid[i + n]) bulbs++;
      if (c > 0 && grid[i - 1]) bulbs++;
      if (c < n - 1 && grid[i + 1]) bulbs++;
      if (bulbs !== p.clues[i]) return false;
    }
  }
  return true;
}

/** Human-style solver (no guessing). `bulbs` marks the cells known to hold a bulb. */
export function solveLogic(p: Shape): { solved: boolean; bulbs: boolean[] } {
  const d = startDoms(p);
  const ok = fixpoint(d, propagators(p));
  const bulbs = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate(p, bulbs), bulbs };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): LightUpPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  const o = gridNeighbours(n, n);
  for (;;) {
    const density = 0.16 + 0.1 * rng();
    const clues = Array.from({ length: n * n }, () => (rng() < density ? BLANK : WHITE));
    const order = shuffle(rng, Array.from({ length: n * n }, (_, i) => i));
    // Bulbs go on cells that nothing lights yet, which keeps them from seeing each other.
    const lit = new Array<boolean>(n * n).fill(false);
    const bulbs = new Array<boolean>(n * n).fill(false);
    for (const i of order) {
      if (clues[i] !== WHITE || lit[i]) continue;
      bulbs[i] = true;
      for (const j of sight(n, clues, i)) lit[j] = true;
    }
    const walls = order.filter((i) => clues[i] === BLANK);
    if (walls.length < n) continue;
    for (const i of walls) clues[i] = o[i].filter((j) => bulbs[j]).length;
    if (!solveLogic({ size: n, clues }).solved) continue;
    // Thin the numbers while the puzzle stays solvable.
    for (const i of walls) {
      const keep = clues[i];
      clues[i] = BLANK;
      if (!solveLogic({ size: n, clues }).solved) clues[i] = keep;
    }
    const p: LightUpPuzzle = { size: n, clues, solution: bulbs, variant: id, seed };
    if (countSolutions(p) === 1 && validate(p, bulbs)) return p;
  }
}
