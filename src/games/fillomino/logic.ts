/**
 * Fillomino: write a number in every cell so that each orthogonally connected group of equal numbers contains exactly
 * that many cells. A few numbers are given.
 */
import { bit, fixpoint, gridNeighbours, isSingle, lowest, probe, search, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

export interface FillominoPuzzle {
  size: number;
  /** Largest number that can appear. */
  maxValue: number;
  /** Row-major, 0 = empty. */
  givens: number[];
  /** Row-major numbers 1..maxValue. */
  solution: number[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string; size: number; max: number }[] = [
  { id: '5', label: '5×5', size: 5, max: 5 },
  { id: '6', label: '6×6', size: 6, max: 5 },
  { id: '8', label: '8×8', size: 8, max: 6 },
];
export const DEFAULT_VARIANT = '6';

type Shape = Pick<FillominoPuzzle, 'size' | 'maxValue' | 'givens'>;

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const V = p.maxValue;
  const o = gridNeighbours(n, n);
  const seen = new Int8Array(n * n);
  const comp = new Int16Array(n * n);
  const edge = new Int8Array(n * n);
  const snap = new Uint32Array(n * n);
  return [
    // Capacity: cells that may hold v must have room for a group of v cells.
    (d) => {
      for (let v = 2; v <= V; v++) {
        seen.fill(0);
        const vb = bit(v);
        for (let s = 0; s < n * n; s++) {
          if (seen[s] || !(d[s] & vb)) continue;
          let len = 1;
          comp[0] = s;
          seen[s] = 1;
          for (let q = 0; q < len; q++) {
            for (const j of o[comp[q]]) {
              if (!seen[j] && d[j] & vb) {
                seen[j] = 1;
                comp[len++] = j;
              }
            }
          }
          if (len < v) {
            for (let q = 0; q < len; q++) {
              const j = comp[q];
              if (d[j] === vb) return false;
              d[j] &= ~vb;
            }
          }
        }
      }
      return true;
    },
    // Groups of decided equal numbers: too big is wrong, full ones are closed, unfinished ones must grow.
    (d) => {
      // Work from a snapshot so groups don't change shape while they are being processed.
      snap.set(d);
      seen.fill(0);
      for (let s = 0; s < n * n; s++) {
        if (seen[s] || !isSingle(snap[s])) continue;
        const v = lowest(snap[s]);
        const vb = bit(v);
        let len = 1;
        comp[0] = s;
        seen[s] = 1;
        for (let q = 0; q < len; q++) {
          for (const j of o[comp[q]]) {
            if (!seen[j] && snap[j] === snap[s]) {
              seen[j] = 1;
              comp[len++] = j;
            }
          }
        }
        if (len > v) return false;
        edge.fill(0);
        let edges = 0;
        let last = -1;
        for (let q = 0; q < len; q++) {
          for (const j of o[comp[q]]) {
            if (snap[j] !== snap[s] && d[j] & vb && !edge[j]) {
              edge[j] = 1;
              edges++;
              last = j;
            }
          }
        }
        if (len === v) {
          for (let j = 0; j < n * n; j++) if (edge[j]) d[j] &= ~vb;
        } else {
          if (edges === 0) return false;
          if (edges === 1) d[last] = vb;
        }
      }
      return true;
    },
  ];
}

function startDoms(p: Shape): Doms {
  const full = ((1 << (p.maxValue + 1)) - 1) & ~1;
  return Uint32Array.from(p.givens, (g) => (g ? bit(g) : full));
}

/** Checks that `grid` is a complete, valid solution (and agrees with the givens). */
export function validate(p: Shape, grid: number[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  if (grid.some((v, i) => !Number.isInteger(v) || v < 1 || (p.givens[i] && p.givens[i] !== v))) return false;
  const seen = new Set<number>();
  for (let s = 0; s < n * n; s++) {
    if (seen.has(s)) continue;
    const comp = [s];
    seen.add(s);
    for (let q = 0; q < comp.length; q++) {
      const [r, c] = [Math.floor(comp[q] / n), comp[q] % n];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [rr, cc] = [r + dr, c + dc];
        const j = rr * n + cc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && !seen.has(j) && grid[j] === grid[s]) {
          seen.add(j);
          comp.push(j);
        }
      }
    }
    if (comp.length !== grid[s]) return false;
  }
  return true;
}

/**
 * Human-style solver (no guessing): group capacity, closed groups and forced growth, plus (with `lookahead`) one-step
 * lookahead: assume a number in a cell and rule it out if that leads to a contradiction.
 * `grid` holds the decided numbers, 0 where undecided.
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

/** Random partition into polyominoes of at most `max` cells, with equal-sized regions never touching. */
function partition(rng: Rng, n: number, max: number): number[] | null {
  const o = gridNeighbours(n, n);
  const owner = new Array<number>(n * n).fill(-1);
  const sizes: number[] = [];
  const order = shuffle(rng, Array.from({ length: n * n }, (_, i) => i));
  for (const s of order) {
    if (owner[s] >= 0) continue;
    const target = 1 + randInt(rng, max);
    const region = [s];
    owner[s] = sizes.length;
    while (region.length < target) {
      const options = region.flatMap((c) => o[c].filter((j) => owner[j] < 0));
      if (options.length === 0) break;
      const next = options[randInt(rng, options.length)];
      owner[next] = sizes.length;
      region.push(next);
    }
    sizes.push(region.length);
  }
  for (let i = 0; i < n * n; i++) {
    for (const j of o[i]) if (owner[i] !== owner[j] && sizes[owner[i]] === sizes[owner[j]]) return null;
  }
  return owner.map((g) => sizes[g]);
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): FillominoPuzzle {
  const v = VARIANTS.find((x) => x.id === variant) ?? VARIANTS.find((x) => x.id === DEFAULT_VARIANT)!;
  const n = v.size;
  const rng = mulberry32(seed);
  for (;;) {
    const solution = partition(rng, n, v.max);
    if (!solution) continue;
    const p: FillominoPuzzle = { size: n, maxValue: v.max, givens: solution.slice(), solution, variant: v.id, seed };
    // Take numbers away while the grid stays solvable by deduction.
    // First cheaply with plain deductions, then again allowing lookahead for what is left.
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
