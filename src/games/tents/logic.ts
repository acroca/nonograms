/**
 * Tents: every tree gets exactly one tent on an orthogonally adjacent cell (a 1:1 matching), tents never touch each
 * other (not even diagonally), and the numbers give how many tents each row and column holds.
 */
import { ANY, countBetween, fixpoint, gridNeighbours, NO, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, shuffle, type Rng } from '../../core/rng';

export interface TentsPuzzle {
  size: number;
  /** Row-major, true = tree. */
  trees: boolean[];
  /** Tents per row / column. */
  rowCounts: number[];
  colCounts: number[];
  /** Row-major, true = tent. */
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

const orth = (n: number) => gridNeighbours(n, n);
const king = (n: number) => gridNeighbours(n, n, true);

/** The propagators (human deductions) for a puzzle. */
function propagators(p: Pick<TentsPuzzle, 'size' | 'trees' | 'rowCounts' | 'colCounts'>): Propagator[] {
  const n = p.size;
  const o = orth(n);
  const k = king(n);
  const props: Propagator[] = [];
  const treeCount = p.trees.filter(Boolean).length;
  const treeCells = p.trees.flatMap((t, i) => (t ? [i] : []));
  for (let r = 0; r < n; r++) {
    props.push(countBetween(Array.from({ length: n }, (_, c) => r * n + c), p.rowCounts[r]));
    props.push(countBetween(Array.from({ length: n }, (_, c) => c * n + r), p.colCounts[r]));
  }
  props.push(countBetween(Array.from({ length: n * n }, (_, i) => i), treeCount));
  // A tent touches no other tent.
  props.push((d) => {
    for (let i = 0; i < d.length; i++) {
      if (d[i] !== YES) continue;
      for (const j of k[i]) {
        if (d[j] === YES) return false;
        d[j] &= NO;
      }
    }
    return true;
  });
  // Every tree needs a tent next to it; a tree whose possible tents all touch a cell rules that cell out.
  props.push((d) => {
    for (const t of treeCells) {
      const cand = o[t].filter((j) => d[j] & YES);
      if (cand.length === 0) return false;
      if (cand.length === 1) d[cand[0]] = YES;
      if (cand.some((j) => d[j] === YES)) continue;
      const seen = new Map<number, number>();
      for (const j of cand) for (const x of k[j]) seen.set(x, (seen.get(x) ?? 0) + 1);
      for (const [x, c] of seen) if (c === cand.length && !cand.includes(x) && !p.trees[x]) d[x] &= NO;
    }
    return true;
  });
  return props;
}

function startDoms(p: Pick<TentsPuzzle, 'size' | 'trees'>): Doms {
  const n = p.size;
  const o = orth(n);
  const d = new Uint32Array(n * n).fill(ANY);
  for (let i = 0; i < n * n; i++) if (p.trees[i] || !o[i].some((j) => p.trees[j])) d[i] = NO;
  return d;
}

/** Perfect matching between trees and tents over orthogonal adjacency. */
function matches(n: number, trees: boolean[], tents: boolean[]): boolean {
  const o = orth(n);
  const owner = new Map<number, number>();
  const treeCells = trees.flatMap((t, i) => (t ? [i] : []));
  if (treeCells.length !== tents.filter(Boolean).length) return false;
  const augment = (t: number, seen: Set<number>): boolean => {
    for (const j of o[t]) {
      if (!tents[j] || seen.has(j)) continue;
      seen.add(j);
      const other = owner.get(j);
      if (other === undefined || augment(other, seen)) {
        owner.set(j, t);
        return true;
      }
    }
    return false;
  };
  return treeCells.every((t) => augment(t, new Set()));
}

/** Checks that `grid` (true = tent) satisfies every rule. */
export function validate(p: TentsPuzzle, grid: boolean[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (!grid[i]) continue;
      if (p.trees[i]) return false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if ((dr || dc) && rr >= 0 && rr < n && cc >= 0 && cc < n && grid[rr * n + cc]) return false;
        }
      }
    }
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
  return matches(n, p.trees, grid);
}

/** Human-style solver (no guessing). `tents` marks the cells known to be tents. */
export function solveLogic(p: Pick<TentsPuzzle, 'size' | 'trees' | 'rowCounts' | 'colCounts'>): { solved: boolean; tents: boolean[] } {
  const d = startDoms(p);
  const ok = fixpoint(d, propagators(p));
  const tents = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate({ ...(p as TentsPuzzle) }, tents), tents };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Pick<TentsPuzzle, 'size' | 'trees' | 'rowCounts' | 'colCounts'>, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p as TentsPuzzle, v.map((x) => x === 1)), limit);
}

/** Random layout: tents first (non-touching), each with a tree beside it. */
function layout(rng: Rng, n: number): { trees: boolean[]; tents: boolean[] } | null {
  const o = orth(n);
  const k = king(n);
  const trees = new Array<boolean>(n * n).fill(false);
  const tents = new Array<boolean>(n * n).fill(false);
  const target = Math.round(n * n * (0.19 + 0.05 * rng()));
  let placed = 0;
  for (const i of shuffle(rng, Array.from({ length: n * n }, (_, x) => x))) {
    if (placed >= target) break;
    if (trees[i] || tents[i] || k[i].some((j) => tents[j])) continue;
    const spots = shuffle(
      rng,
      o[i].filter((j) => !trees[j] && !tents[j]),
    );
    if (spots.length === 0) continue;
    tents[i] = true;
    trees[spots[0]] = true;
    placed++;
  }
  return placed === target ? { trees, tents } : null;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): TentsPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const lay = layout(rng, n);
    if (!lay) continue;
    const rowCounts = Array.from({ length: n }, (_, r) => lay.tents.slice(r * n, r * n + n).filter(Boolean).length);
    const colCounts = Array.from({ length: n }, (_, c) => lay.tents.filter((t, i) => t && i % n === c).length);
    const base = { size: n, trees: lay.trees, rowCounts, colCounts };
    // Trees whose tent could go in more than one place make a puzzle ambiguous; solveLogic decides.
    const result = solveLogic(base);
    if (!result.solved) continue;
    const p: TentsPuzzle = { ...base, solution: result.tents, variant: id, seed };
    if (countSolutions(p) === 1) return p;
  }
}
