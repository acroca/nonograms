/**
 * Skyscrapers: fill an N×N grid with buildings of heights 1..N so every row and column holds each height once.
 * A clue on the edge says how many buildings can be seen looking along that row or column from that side (taller
 * buildings hide shorter ones behind them).
 */
import { allDifferent, bit, fixpoint, search, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, shuffle, type Rng } from '../../core/rng';

export interface SkyscrapersPuzzle {
  size: number;
  /** Visible counts per side, 0 = no clue. top/bottom per column, left/right per row. */
  top: number[];
  bottom: number[];
  left: number[];
  right: number[];
  /** Row-major heights 1..N. */
  solution: number[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '4', label: '4×4' },
  { id: '5', label: '5×5' },
  { id: '6', label: '6×6' },
];
export const DEFAULT_VARIANT = '5';

type Shape = Pick<SkyscrapersPuzzle, 'size' | 'top' | 'bottom' | 'left' | 'right'>;

/** How many buildings are visible in `line` (heights, nearest first). */
export const visible = (line: ArrayLike<number>): number => {
  let seen = 0;
  let tallest = 0;
  for (let k = 0; k < line.length; k++) {
    if (line[k] > tallest) {
      tallest = line[k];
      seen++;
    }
  }
  return seen;
};

const permCache = new Map<number, number[][][]>();
/** All permutations of 1..n grouped by how many are visible. */
function permsByVisible(n: number): number[][][] {
  let by = permCache.get(n);
  if (!by) {
    by = Array.from({ length: n + 1 }, () => []);
    const used = new Array<boolean>(n + 1).fill(false);
    const cur: number[] = [];
    const go = () => {
      if (cur.length === n) {
        by![visible(cur)].push(cur.slice());
        return;
      }
      for (let v = 1; v <= n; v++) {
        if (used[v]) continue;
        used[v] = true;
        cur.push(v);
        go();
        cur.pop();
        used[v] = false;
      }
    };
    go();
    permCache.set(n, by);
  }
  return by;
}

/** The cells of every clue's line, nearest cell first, paired with the clue. */
function lines(p: Shape): { cells: number[]; clue: number }[] {
  const n = p.size;
  const out: { cells: number[]; clue: number }[] = [];
  for (let k = 0; k < n; k++) {
    const col = Array.from({ length: n }, (_, r) => r * n + k);
    const row = Array.from({ length: n }, (_, c) => k * n + c);
    out.push({ cells: col, clue: p.top[k] }, { cells: col.slice().reverse(), clue: p.bottom[k] });
    out.push({ cells: row, clue: p.left[k] }, { cells: row.slice().reverse(), clue: p.right[k] });
  }
  return out;
}

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const by = permsByVisible(n);
  const props: Propagator[] = [];
  for (let k = 0; k < n; k++) {
    props.push(allDifferent(Array.from({ length: n }, (_, c) => k * n + c), true));
    props.push(allDifferent(Array.from({ length: n }, (_, r) => r * n + k), true));
  }
  for (const { cells, clue } of lines(p)) {
    if (!clue) continue;
    const perms = by[clue];
    props.push((d) => {
      const allowed = new Array<number>(n).fill(0);
      let any = false;
      for (const perm of perms) {
        let ok = true;
        for (let k = 0; k < n; k++) {
          if (!(d[cells[k]] & bit(perm[k]))) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        any = true;
        for (let k = 0; k < n; k++) allowed[k] |= bit(perm[k]);
      }
      if (!any) return false;
      for (let k = 0; k < n; k++) d[cells[k]] &= allowed[k];
      return true;
    });
  }
  return props;
}

const startDoms = (p: Shape): Doms => new Uint32Array(p.size * p.size).fill(((1 << (p.size + 1)) - 1) & ~1);

/** Checks that `grid` (heights) is a complete, valid solution. */
export function validate(p: Shape, grid: number[]): boolean {
  const n = p.size;
  if (grid.length !== n * n) return false;
  for (let k = 0; k < n; k++) {
    const row = grid.slice(k * n, k * n + n);
    const col = Array.from({ length: n }, (_, r) => grid[r * n + k]);
    for (const line of [row, col]) {
      if (new Set(line).size !== n || line.some((v) => !Number.isInteger(v) || v < 1 || v > n)) return false;
    }
    const check = (clue: number, line: number[]) => !clue || visible(line) === clue;
    if (!check(p.top[k], col) || !check(p.bottom[k], col.slice().reverse())) return false;
    if (!check(p.left[k], row) || !check(p.right[k], row.slice().reverse())) return false;
  }
  return true;
}

/** Human-style solver (no guessing). `grid` holds the decided heights, 0 where undecided. */
export function solveLogic(p: Shape): { solved: boolean; grid: number[] } {
  const d = startDoms(p);
  const ok = fixpoint(d, propagators(p));
  const grid = Array.from(d, (m) => ((m & (m - 1)) === 0 && m ? 31 - Math.clz32(m) : 0));
  return { solved: ok && grid.every(Boolean) && validate(p, grid), grid };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v), limit);
}

/** Random Latin square (values 1..n). */
function latinSquare(rng: Rng, n: number): number[] {
  const grid = new Array<number>(n * n).fill(0);
  const rowUsed = new Array<number>(n).fill(0);
  const colUsed = new Array<number>(n).fill(0);
  const fill = (i: number): boolean => {
    if (i === n * n) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const v of shuffle(rng, Array.from({ length: n }, (_, k) => k))) {
      const b = 1 << v;
      if ((rowUsed[r] | colUsed[c]) & b) continue;
      rowUsed[r] |= b;
      colUsed[c] |= b;
      grid[i] = v + 1;
      if (fill(i + 1)) return true;
      rowUsed[r] &= ~b;
      colUsed[c] &= ~b;
    }
    return false;
  };
  fill(0);
  return grid;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): SkyscrapersPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const solution = latinSquare(rng, n);
    const col = (c: number) => Array.from({ length: n }, (_, r) => solution[r * n + c]);
    const row = (r: number) => solution.slice(r * n, r * n + n);
    const p: SkyscrapersPuzzle = {
      size: n,
      top: Array.from({ length: n }, (_, c) => visible(col(c))),
      bottom: Array.from({ length: n }, (_, c) => visible(col(c).reverse())),
      left: Array.from({ length: n }, (_, r) => visible(row(r))),
      right: Array.from({ length: n }, (_, r) => visible(row(r).reverse())),
      solution,
      variant: id,
      seed,
    };
    if (!solveLogic(p).solved) continue;
    // Drop clues in random order while the puzzle stays solvable.
    const slots = shuffle(
      rng,
      (['top', 'bottom', 'left', 'right'] as const).flatMap((side) => Array.from({ length: n }, (_, k) => [side, k] as const)),
    );
    const removed: (readonly [typeof slots[number][0], number])[] = [];
    const full = { top: p.top.slice(), bottom: p.bottom.slice(), left: p.left.slice(), right: p.right.slice() };
    for (const [side, k] of slots) {
      p[side][k] = 0;
      if (solveLogic(p).solved) removed.push([side, k]);
      else p[side][k] = full[side][k];
    }
    // Minimal clue sets need a lot of lookahead from a person: hand a share of the clues back.
    for (const [side, k] of removed.slice(0, Math.round(removed.length * 0.3))) p[side][k] = full[side][k];
    if (countSolutions(p) === 1) return p;
  }
}
