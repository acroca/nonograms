/**
 * Mosaic (a.k.a. Fill-a-Pix): shade cells so that every number counts the shaded cells in the 3×3 block around it
 * (itself included; cells off the board don't count). Shading all numbers correctly reveals a picture.
 */
import { ANY, countBetween, fixpoint, NO, probe, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, shuffle, type Rng } from '../../core/rng';

export interface MosaicPuzzle {
  size: number;
  /** Row-major: -1 = no number, otherwise 0..9. */
  clues: number[];
  /** Row-major, true = shaded. */
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

type Shape = Pick<MosaicPuzzle, 'size' | 'clues'>;

/** The cells of the 3×3 block around `i` that lie on the board. */
export function block(n: number, i: number): number[] {
  const out: number[] = [];
  const [r, c] = [Math.floor(i / n), i % n];
  for (let rr = Math.max(0, r - 1); rr <= Math.min(n - 1, r + 1); rr++) {
    for (let cc = Math.max(0, c - 1); cc <= Math.min(n - 1, c + 1); cc++) out.push(rr * n + cc);
  }
  return out;
}

function propagators(p: Shape): Propagator[] {
  return p.clues.flatMap((k, i) => (k < 0 ? [] : [countBetween(block(p.size, i), k)]));
}

const startDoms = (p: Shape): Doms => new Uint32Array(p.size * p.size).fill(ANY);

/** Checks that `grid` (true = shaded) satisfies every number. */
export function validate(p: Shape, grid: boolean[]): boolean {
  if (grid.length !== p.size * p.size) return false;
  return p.clues.every((k, i) => k < 0 || block(p.size, i).filter((j) => grid[j]).length === k);
}

/**
 * Human-style solver (no guessing): the counts of overlapping blocks, plus one-step lookahead (with `lookahead`).
 * `shaded` marks the cells known to be shaded.
 */
export function solveLogic(p: Shape, lookahead = true): { solved: boolean; shaded: boolean[] } {
  const d = startDoms(p);
  const props = propagators(p);
  let ok = fixpoint(d, props);
  if (ok && lookahead && d.some((m) => m === ANY)) ok = probe(d, props);
  const shaded = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate(p, shaded), shaded };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/** A blobby random picture: noise smoothed by a few majority-vote passes. */
function randomPicture(rng: Rng, n: number): boolean[] {
  let grid = Array.from({ length: n * n }, () => rng() < 0.5);
  for (let pass = 0; pass < 2; pass++) {
    grid = grid.map((_, i) => {
      const cells = block(n, i);
      const on = cells.filter((j) => grid[j]).length;
      return on * 2 > cells.length || (on * 2 === cells.length && rng() < 0.5);
    });
  }
  return grid;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): MosaicPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const solution = randomPicture(rng, n);
    const shadedShare = solution.filter(Boolean).length / (n * n);
    if (shadedShare < 0.3 || shadedShare > 0.7) continue;
    const clues = solution.map((_, i) => block(n, i).filter((j) => solution[j]).length);
    const p: MosaicPuzzle = { size: n, clues, solution, variant: id, seed };
    if (!solveLogic(p, false).solved) continue;
    // Drop numbers first while plain deductions suffice, then while lookahead does.
    for (const lookahead of [false, true]) {
      for (const i of shuffle(rng, Array.from({ length: n * n }, (_, k) => k))) {
        if (clues[i] < 0) continue;
        const keep = clues[i];
        clues[i] = -1;
        if (!solveLogic(p, lookahead).solved) clues[i] = keep;
      }
    }
    if (countSolutions(p) === 1) return p;
  }
}
