/**
 * Norinori: shade cells so that every outlined region holds exactly two shaded cells, and every shaded cell is part
 * of exactly one domino: it has exactly one shaded orthogonal neighbour (so dominoes never touch side by side).
 */
import { ANY, countBetween, fixpoint, gridNeighbours, NO, probe, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

export interface NorinoriPuzzle {
  size: number;
  /** Row-major region id per cell; every region is orthogonally connected. */
  regions: number[];
  /** Row-major, true = shaded. */
  solution: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '5', label: '5×5' },
  { id: '6', label: '6×6' },
];
export const DEFAULT_VARIANT = '6';

type Shape = Pick<NorinoriPuzzle, 'size' | 'regions'>;

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const o = gridNeighbours(n, n);
  const props: Propagator[] = [];
  const count = Math.max(...p.regions) + 1;
  for (let g = 0; g < count; g++) {
    props.push(countBetween(p.regions.flatMap((r, i) => (r === g ? [i] : [])), 2));
  }
  // Domino rule: a shaded cell has exactly one shaded neighbour; a cell with two shaded neighbours can't be shaded.
  props.push((d) => {
    for (let i = 0; i < n * n; i++) {
      if (d[i] === NO) continue;
      let yes = 0;
      const open: number[] = [];
      for (const j of o[i]) {
        if (d[j] === YES) yes++;
        else if (d[j] === ANY) open.push(j);
      }
      if (d[i] === YES) {
        if (yes > 1 || yes + open.length < 1) return false;
        if (yes === 1) for (const j of open) d[j] = NO;
        else if (open.length === 1) d[open[0]] = YES;
      } else if (yes >= 2 || (yes === 0 && open.length === 0)) {
        d[i] = NO;
      }
    }
    return true;
  });
  return props;
}

const startDoms = (p: Shape): Doms => new Uint32Array(p.size * p.size).fill(ANY);

/** Checks that `grid` (true = shaded) is a complete, valid solution. */
export function validate(p: Shape, grid: boolean[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  const per = new Map<number, number>();
  for (let i = 0; i < n * n; i++) if (grid[i]) per.set(p.regions[i], (per.get(p.regions[i]) ?? 0) + 1);
  const regionCount = Math.max(...p.regions) + 1;
  for (let g = 0; g < regionCount; g++) if ((per.get(g) ?? 0) !== 2) return false;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!grid[r * n + c]) continue;
      const nb = [r > 0 && grid[(r - 1) * n + c], r < n - 1 && grid[(r + 1) * n + c], c > 0 && grid[r * n + c - 1], c < n - 1 && grid[r * n + c + 1]];
      if (nb.filter(Boolean).length !== 1) return false;
    }
  }
  return true;
}

/**
 * Human-style solver (no guessing): region counts and the domino rule, plus one-step lookahead (assume a cell is
 * shaded or not and rule it out if that contradicts). `shaded` marks the cells known to be shaded.
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

/** Random non-touching dominoes, then regions grown around them (each domino is the shaded pair of its region). */
function plant(rng: Rng, n: number): { regions: number[]; shaded: boolean[] } {
  const o = gridNeighbours(n, n);
  const shaded = new Array<boolean>(n * n).fill(false);
  const regions = new Array<number>(n * n).fill(-1);
  const target = Math.round((n * n) / 5.2);
  let made = 0;
  for (const i of shuffle(rng, Array.from({ length: n * n }, (_, k) => k))) {
    if (made >= target) break;
    if (shaded[i] || o[i].some((j) => shaded[j])) continue;
    const mates = shuffle(rng, o[i].filter((j) => !shaded[j] && o[j].every((k) => k === i || !shaded[k])));
    if (mates.length === 0) continue;
    shaded[i] = shaded[mates[0]] = true;
    regions[i] = regions[mates[0]] = made++;
  }
  let free = regions.filter((g) => g < 0).length;
  while (free > 0) {
    const i = randInt(rng, n * n);
    if (regions[i] >= 0) continue;
    const near = o[i].filter((j) => regions[j] >= 0);
    if (near.length === 0) continue;
    regions[i] = regions[near[randInt(rng, near.length)]];
    free--;
  }
  return { regions, shaded };
}

/** Whether the cells of region `g` stay connected without `skip`. */
function connectedWithout(o: number[][], regions: number[], g: number, skip: number): boolean {
  const cells = regions.flatMap((r, i) => (r === g && i !== skip ? [i] : []));
  if (cells.length === 0) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    for (const j of o[stack.pop()!]) {
      if (j !== skip && regions[j] === g && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): NorinoriPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  const o = gridNeighbours(n, n);
  for (;;) {
    const planted = plant(rng, n);
    let regions = planted.regions;
    // How many cells the deductions leave undecided (0 = solved); the planted solution always stays valid.
    const score = (r: number[]): number => {
      const d = startDoms({ size: n, regions: r });
      const props = propagators({ size: n, regions: r });
      if (!fixpoint(d, props)) return 999;
      return d.filter((m) => m === ANY).length;
    };
    let cur = score(regions);
    let done = false;
    let tried = 99;
    for (let iter = 0; iter < 2500 && !done; iter++) {
      if (cur <= 8 && cur < tried) {
        // Close enough: let lookahead try to finish the grid (once per improvement).
        tried = cur;
        if (solveLogic({ size: n, regions }).solved) {
          done = true;
          break;
        }
      }
      const i = randInt(rng, n * n);
      if (planted.shaded[i]) continue;
      const g = regions[i];
      const targets = [...new Set(o[i].map((j) => regions[j]).filter((x) => x !== g))];
      if (targets.length === 0 || !connectedWithout(o, regions, g, i)) continue;
      const next = regions.slice();
      next[i] = targets[randInt(rng, targets.length)];
      const s2 = score(next);
      if (s2 <= cur) {
        regions = next;
        cur = s2;
      }
    }
    if (!done) continue;
    const p: NorinoriPuzzle = { size: n, regions, solution: [], variant: id, seed };
    const res = solveLogic(p);
    if (res.solved && countSolutions(p) === 1) return { ...p, solution: res.shaded };
  }
}
