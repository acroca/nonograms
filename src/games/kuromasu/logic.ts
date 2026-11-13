/**
 * Kuromasu: shade some cells. Each number says how many cells you can see from it, itself included, looking along
 * its row and column until a shaded cell or the edge. Shaded cells never touch side by side, numbered cells are never
 * shaded, and all unshaded cells form one connected area.
 */
import { ANY, connectedGroup, fixpoint, gridNeighbours, NO, probe, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, shuffle, type Rng } from '../../core/rng';

export interface KuromasuPuzzle {
  size: number;
  /** Row-major, 0 = no number. */
  clues: number[];
  /** Row-major, true = shaded. */
  solution: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '5', label: '5×5' },
  { id: '7', label: '7×7' },
  { id: '9', label: '9×9' },
];
export const DEFAULT_VARIANT = '7';

type Shape = Pick<KuromasuPuzzle, 'size' | 'clues'>;
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const o = gridNeighbours(n, n);
  const props: Propagator[] = [];
  // Shaded cells have only unshaded neighbours.
  props.push((d) => {
    for (let i = 0; i < n * n; i++) {
      if (d[i] !== YES) continue;
      for (const j of o[i]) {
        if (d[j] === YES) return false;
        d[j] &= NO;
      }
    }
    return true;
  });
  // Numbers: the lengths seen in the four directions add up to the number minus one.
  p.clues.forEach((k, i) => {
    if (!k) return;
    const [r, c] = [Math.floor(i / n), i % n];
    const rays = DIRS.map(([dr, dc]) => {
      const cells: number[] = [];
      for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n; rr += dr, cc += dc) cells.push(rr * n + cc);
      return cells;
    });
    props.push((d) => {
      const min: number[] = [];
      const max: number[] = [];
      for (const ray of rays) {
        let lo = 0;
        while (lo < ray.length && d[ray[lo]] === NO) lo++;
        let hi = lo;
        while (hi < ray.length && d[ray[hi]] !== YES) hi++;
        min.push(lo);
        max.push(hi);
      }
      const sumMin = min.reduce((a, b) => a + b, 0);
      const sumMax = max.reduce((a, b) => a + b, 0);
      const need = k - 1;
      if (sumMin > need || sumMax < need) return false;
      rays.forEach((ray, q) => {
        const lower = need - (sumMax - max[q]);
        const upper = need - (sumMin - min[q]);
        for (let m = 0; m < lower && m < ray.length; m++) d[ray[m]] &= NO;
        // The run can't be longer than `upper`: the cell after it is shaded when the run reaches it.
        if (upper < ray.length && min[q] >= upper) d[ray[upper]] &= YES;
      });
      return true;
    });
  });
  props.push(connectedGroup(o, 0));
  return props;
}

function startDoms(p: Shape): Doms {
  return Uint32Array.from(p.clues, (k) => (k ? NO : ANY));
}

/** Cells visible from `i` (itself included) when `grid` (true = shaded) is placed. */
function seen(n: number, grid: boolean[], i: number): number {
  let count = 1;
  const [r, c] = [Math.floor(i / n), i % n];
  for (const [dr, dc] of DIRS) {
    for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n && !grid[rr * n + cc]; rr += dr, cc += dc) count++;
  }
  return count;
}

/** Checks that `grid` (true = shaded) is a complete, valid solution. */
export function validate(p: Shape, grid: boolean[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  for (let i = 0; i < n * n; i++) {
    if (p.clues[i] && (grid[i] || seen(n, grid, i) !== p.clues[i])) return false;
    if (grid[i] && ((i % n < n - 1 && grid[i + 1]) || (i + n < n * n && grid[i + n]))) return false;
  }
  const start = grid.indexOf(false);
  if (start < 0) return false;
  const reached = new Set([start]);
  const stack = [start];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const [r, c] = [Math.floor(i / n), i % n];
    for (const [dr, dc] of DIRS) {
      const [rr, cc] = [r + dr, c + dc];
      const j = rr * n + cc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && !grid[j] && !reached.has(j)) {
        reached.add(j);
        stack.push(j);
      }
    }
  }
  return reached.size === grid.filter((s) => !s).length;
}

/**
 * Human-style solver (no guessing): visibility counts, no touching shaded cells, connected white area, plus one-step
 * lookahead. `shaded` marks the cells known to be shaded.
 */
export function solveLogic(p: Shape): { solved: boolean; shaded: boolean[] } {
  const d = startDoms(p);
  const props = propagators(p);
  let ok = fixpoint(d, props);
  if (ok && d.some((m) => m === ANY)) ok = probe(d, props);
  const shaded = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate(p, shaded), shaded };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/** Random non-touching shading (about 20–28%) that keeps the white cells connected. */
function randomShading(rng: Rng, n: number): boolean[] {
  const o = gridNeighbours(n, n);
  const shaded = new Array<boolean>(n * n).fill(false);
  const target = Math.round(n * n * (0.2 + 0.08 * rng()));
  let count = 0;
  const connectedWithout = (x: number): boolean => {
    const start = x === 0 ? 1 : 0;
    const seenCells = new Uint8Array(n * n);
    seenCells[start] = 1;
    const stack = [start];
    let reached = 1;
    while (stack.length > 0) {
      for (const j of o[stack.pop()!]) {
        if (j === x || shaded[j] || seenCells[j]) continue;
        seenCells[j] = 1;
        reached++;
        stack.push(j);
      }
    }
    return reached === n * n - count - 1;
  };
  for (const i of shuffle(rng, Array.from({ length: n * n }, (_, k) => k))) {
    if (count >= target) break;
    if (o[i].some((j) => shaded[j]) || !connectedWithout(i)) continue;
    shaded[i] = true;
    count++;
  }
  return shaded;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): KuromasuPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const solution = randomShading(rng, n);
    const clues = solution.map((s, i) => (s ? 0 : seen(n, solution, i)));
    const p: KuromasuPuzzle = { size: n, clues, solution, variant: id, seed };
    if (!solveLogic(p).solved) continue;
    // Drop numbers while the grid stays solvable.
    for (const i of shuffle(rng, Array.from({ length: n * n }, (_, k) => k))) {
      if (!clues[i]) continue;
      const keep = clues[i];
      clues[i] = 0;
      if (!solveLogic(p).solved) clues[i] = keep;
    }
    if (countSolutions(p) === 1) return p;
  }
}
