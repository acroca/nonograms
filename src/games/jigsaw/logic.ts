/**
 * Jigsaw Sudoku: fill an N×N grid with 1..N so every row, column and irregular region (N cells each) holds each
 * digit exactly once. Some digits are given.
 */
import { allDifferent, bit, fixpoint, gridNeighbours, isSingle, lowest, probe, search, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

export interface JigsawPuzzle {
  size: number;
  /** Row-major region id 0..size-1 per cell; every region is connected and has `size` cells. */
  regions: number[];
  /** Row-major, 0 = empty. */
  givens: number[];
  solution: number[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '5', label: '5×5' },
  { id: '6', label: '6×6' },
  { id: '7', label: '7×7' },
  { id: '9', label: '9×9' },
];
export const DEFAULT_VARIANT = '7';

type Shape = Pick<JigsawPuzzle, 'size' | 'regions' | 'givens'>;

/** The rows, columns and regions as lists of cells. */
export function groupsOf(n: number, regions: number[]): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < n; k++) {
    out.push(Array.from({ length: n }, (_, c) => k * n + c));
    out.push(Array.from({ length: n }, (_, r) => r * n + k));
  }
  for (let g = 0; g < n; g++) out.push(regions.flatMap((r, i) => (r === g ? [i] : [])));
  return out;
}

/** Cells sharing a row, column or region with `i`. */
export function peersOf(n: number, regions: number[]): (i: number) => number[] {
  const cache: number[][] = [];
  return (i) => {
    if (cache[i]) return cache[i];
    const out = new Set<number>();
    for (let k = 0; k < n; k++) {
      out.add(Math.floor(i / n) * n + k);
      out.add(k * n + (i % n));
    }
    regions.forEach((g, j) => g === regions[i] && out.add(j));
    out.delete(i);
    return (cache[i] = [...out]);
  };
}

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const groups = groupsOf(n, p.regions);
  const props: Propagator[] = groups.map((g) => allDifferent(g, true));
  // Locked candidates: if a digit in one group can only sit where it meets another group, it's out of the rest of that one.
  const rowsCols = groups.slice(0, 2 * n);
  const regionGroups = groups.slice(2 * n);
  const pairs: { a: number[]; b: number[]; inter: number[] }[] = [];
  for (const line of rowsCols) {
    for (const region of regionGroups) {
      const inter = line.filter((c) => region.includes(c));
      if (inter.length > 1 && inter.length < n) {
        pairs.push({ a: line, b: region, inter });
        pairs.push({ a: region, b: line, inter });
      }
    }
  }
  props.push((d) => {
    for (const { a, b, inter } of pairs) {
      let inside = 0;
      let outside = 0;
      for (const c of a) {
        if (inter.includes(c)) inside |= d[c];
        else outside |= d[c];
      }
      // Digits that appear in `a` only inside the overlap can't appear in the rest of `b`.
      const only = inside & ~outside;
      if (only) for (const c of b) if (!inter.includes(c) && !isSingle(d[c])) d[c] &= ~only;
    }
    return true;
  });
  return props;
}

function startDoms(p: Shape): Doms {
  const full = ((1 << (p.size + 1)) - 1) & ~1;
  return Uint32Array.from(p.givens, (g) => (g ? bit(g) : full));
}

/** Checks that `grid` is a complete, valid solution (and agrees with the givens). */
export function validate(p: Shape, grid: number[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  if (grid.some((v, i) => !Number.isInteger(v) || v < 1 || v > n || (p.givens[i] && p.givens[i] !== v))) return false;
  return groupsOf(n, p.regions).every((g) => new Set(g.map((i) => grid[i])).size === n);
}

/**
 * Human-style solver (no guessing): naked and hidden singles in rows, columns and regions, locked candidates between
 * them, plus (with `lookahead`) one-step lookahead. `grid` holds the decided digits, 0 where undecided.
 */
export function solveLogic(p: Shape, lookahead = true): { solved: boolean; grid: number[] } {
  const d = startDoms(p);
  const props = propagators(p);
  let ok = fixpoint(d, props);
  if (ok && lookahead && d.some((m) => !isSingle(m))) ok = probe(d, props);
  const grid = Array.from(d, (m) => (isSingle(m) ? lowest(m) : 0));
  return { solved: ok && grid.every(Boolean) && validate(p, grid), grid };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v), limit);
}

/**
 * Random partition into `n` connected regions of `n` cells: regions are carved out one by one, starting from the
 * awkward corners of what is left, and a carve is rejected if it would strand a piece whose size isn't a multiple of n.
 */
function randomRegions(rng: Rng, n: number): number[] | null {
  const o = gridNeighbours(n, n);
  const owner = new Array<number>(n * n).fill(-1);
  const freeNeighbours = (c: number) => o[c].filter((j) => owner[j] < 0).length;
  const pocketsOk = (): boolean => {
    const seen = new Uint8Array(n * n);
    for (let s = 0; s < n * n; s++) {
      if (owner[s] >= 0 || seen[s]) continue;
      const stack = [s];
      seen[s] = 1;
      let size = 0;
      while (stack.length > 0) {
        const c = stack.pop()!;
        size++;
        for (const j of o[c]) if (owner[j] < 0 && !seen[j]) (seen[j] = 1, stack.push(j));
      }
      if (size % n !== 0) return false;
    }
    return true;
  };
  for (let g = 0; g < n - 1; g++) {
    let done = false;
    for (let attempt = 0; attempt < 60 && !done; attempt++) {
      const free = Array.from({ length: n * n }, (_, c) => c).filter((c) => owner[c] < 0);
      const fewest = Math.min(...free.map(freeNeighbours));
      const starts = free.filter((c) => freeNeighbours(c) <= fewest + (attempt > 20 ? 2 : 0));
      const region = [starts[randInt(rng, starts.length)]];
      owner[region[0]] = g;
      while (region.length < n) {
        const options = region.flatMap((c) => o[c].filter((j) => owner[j] < 0));
        if (options.length === 0) break;
        // Prefer cells that are hard to reach otherwise.
        const scored = options.map((j) => [j, 1 / (1 + freeNeighbours(j))] as const);
        let roll = rng() * scored.reduce((sum, [, w]) => sum + w, 0);
        let pick = scored[scored.length - 1][0];
        for (const [j, w] of scored) if ((roll -= w) < 0) (pick = j, roll = Infinity);
        owner[pick] = g;
        region.push(pick);
      }
      if (region.length === n && pocketsOk()) done = true;
      else for (const c of region) owner[c] = -1;
    }
    if (!done) return null;
  }
  return owner.map((x) => (x < 0 ? n - 1 : x));
}

/** A random full grid for the regions by randomised backtracking (null if it takes too long or can't be done). */
function randomSolution(rng: Rng, n: number, regions: number[]): number[] | null {
  const grid = new Array<number>(n * n).fill(0);
  const rowUsed = new Array<number>(n).fill(0);
  const colUsed = new Array<number>(n).fill(0);
  const regUsed = new Array<number>(n).fill(0);
  let budget = 20000;
  const fill = (i: number): boolean => {
    if (i === n * n) return true;
    if (--budget < 0) return false;
    const [r, c] = [Math.floor(i / n), i % n];
    for (const v of shuffle(rng, Array.from({ length: n }, (_, k) => k))) {
      const b = 1 << v;
      if ((rowUsed[r] | colUsed[c] | regUsed[regions[i]]) & b) continue;
      rowUsed[r] |= b;
      colUsed[c] |= b;
      regUsed[regions[i]] |= b;
      grid[i] = v + 1;
      if (fill(i + 1)) return true;
      rowUsed[r] &= ~b;
      colUsed[c] &= ~b;
      regUsed[regions[i]] &= ~b;
    }
    return false;
  };
  return fill(0) ? grid : null;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): JigsawPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const regions = randomRegions(rng, n);
    if (!regions) continue;
    const solution = randomSolution(rng, n, regions);
    if (!solution) continue;
    const p: JigsawPuzzle = { size: n, regions, givens: solution.slice(), solution, variant: id, seed };
    // Remove digits while the grid stays solvable: plain deductions first, then with lookahead.
    for (const lookahead of [false, true]) {
      for (const i of shuffle(rng, Array.from({ length: n * n }, (_, k) => k))) {
        if (!p.givens[i]) continue;
        const keep = p.givens[i];
        p.givens[i] = 0;
        if (!solveLogic(p, lookahead).solved) p.givens[i] = keep;
      }
    }
    if (countSolutions(p) === 1) return p;
  }
}
