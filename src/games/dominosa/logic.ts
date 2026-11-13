/**
 * Dominosa: a rectangle of numbers 0..N is the surface of a full double-N domino set laid out flat. Cut it into
 * dominoes so every pair of numbers (0-0, 0-1, … N-N) appears exactly once.
 */
import { ANY, countBetween, fixpoint, NO, probe, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

export interface DominosaPuzzle {
  /** Largest number N: the grid has N+1 rows and N+2 columns. */
  max: number;
  rows: number;
  cols: number;
  /** Row-major numbers 0..max. */
  numbers: number[];
  /** Possible dominoes: pairs of adjacent cells, horizontal ones first (`r * (cols - 1) + c`), then vertical. */
  edges: [number, number][];
  /** Per edge: true = a domino lies there. */
  solution: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '3', label: 'Double 3' },
  { id: '4', label: 'Double 4' },
  { id: '5', label: 'Double 5' },
  { id: '6', label: 'Double 6' },
];
export const DEFAULT_VARIANT = '5';

/** All pairs of neighbouring cells of a rows × cols grid: horizontal first, then vertical. */
export function edgesFor(rows: number, cols: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) out.push([r * cols + c, r * cols + c + 1]);
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) out.push([r * cols + c, (r + 1) * cols + c]);
  return out;
}

type Shape = Pick<DominosaPuzzle, 'max' | 'rows' | 'cols' | 'numbers' | 'edges'>;

const pairKey = (max: number, a: number, b: number) => Math.min(a, b) * (max + 1) + Math.max(a, b);

function propagators(p: Shape): Propagator[] {
  const props: Propagator[] = [];
  const byCell: number[][] = Array.from({ length: p.numbers.length }, () => []);
  const byPair = new Map<number, number[]>();
  p.edges.forEach(([a, b], e) => {
    byCell[a].push(e);
    byCell[b].push(e);
    const key = pairKey(p.max, p.numbers[a], p.numbers[b]);
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(e);
  });
  // Every cell is in exactly one domino; every number pair is used exactly once.
  for (const es of byCell) props.push(countBetween(es, 1));
  for (const es of byPair.values()) props.push(countBetween(es, 1));
  return props;
}

const startDoms = (p: Shape): Doms => new Uint32Array(p.edges.length).fill(ANY);

/** Checks that `layout` (per edge) is a complete, valid solution. */
export function validate(p: Shape, layout: boolean[]): boolean {
  if (layout.length !== p.edges.length) return false;
  const covered = new Array<number>(p.numbers.length).fill(0);
  const pairs = new Set<number>();
  for (let e = 0; e < layout.length; e++) {
    if (!layout[e]) continue;
    const [a, b] = p.edges[e];
    covered[a]++;
    covered[b]++;
    const key = pairKey(p.max, p.numbers[a], p.numbers[b]);
    if (pairs.has(key)) return false;
    pairs.add(key);
  }
  return covered.every((c) => c === 1);
}

/**
 * Human-style solver (no guessing): one domino per cell, one per number pair, plus one-step lookahead.
 * `layout` marks the dominoes known to be placed.
 */
export function solveLogic(p: Shape, lookahead = true): { solved: boolean; layout: boolean[] } {
  const d = startDoms(p);
  const props = propagators(p);
  let ok = fixpoint(d, props);
  if (ok && lookahead && d.some((m) => m === ANY)) ok = probe(d, props);
  const layout = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate(p, layout), layout };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/** Random tiling of the grid by dominoes (as pairs of cells), by randomised backtracking. */
function randomTiling(rng: Rng, rows: number, cols: number): [number, number][] {
  const used = new Array<boolean>(rows * cols).fill(false);
  const tiles: [number, number][] = [];
  const fill = (from: number): boolean => {
    let i = from;
    while (i < rows * cols && used[i]) i++;
    if (i === rows * cols) return true;
    const options: number[] = [];
    if (i % cols < cols - 1 && !used[i + 1]) options.push(i + 1);
    if (i + cols < rows * cols) options.push(i + cols);
    for (const j of shuffle(rng, options)) {
      used[i] = used[j] = true;
      tiles.push([i, j]);
      if (fill(i + 1)) return true;
      tiles.pop();
      used[i] = used[j] = false;
    }
    return false;
  };
  fill(0);
  return tiles;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): DominosaPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const max = Number(id);
  const [rows, cols] = [max + 1, max + 2];
  const rng = mulberry32(seed);
  const edges = edgesFor(rows, cols);
  const edgeOf = new Map(edges.map(([a, b], e) => [`${a}:${b}`, e]));
  const pairs: [number, number][] = [];
  for (let a = 0; a <= max; a++) for (let b = a; b <= max; b++) pairs.push([a, b]);
  for (;;) {
    const tiles = randomTiling(rng, rows, cols);
    const labels = shuffle(rng, pairs.slice());
    const numbers = new Array<number>(rows * cols).fill(0);
    const solution = new Array<boolean>(edges.length).fill(false);
    tiles.forEach(([a, b], k) => {
      const flip = rng() < 0.5;
      numbers[a] = labels[k][flip ? 1 : 0];
      numbers[b] = labels[k][flip ? 0 : 1];
      solution[edgeOf.get(`${a}:${b}`)!] = true;
    });
    const p: DominosaPuzzle = { max, rows, cols, numbers, edges, solution, variant: id, seed };
    // Re-deal the numbers over the same tiling (swap two dominoes' labels) until the deductions solve it.
    let score = (() => {
      const d = startDoms(p);
      return fixpoint(d, propagators(p)) ? d.filter((m) => m === ANY).length : 999;
    })();
    for (let iter = 0; iter < 600 && score > 0; iter++) {
      const [x, y] = [randInt(rng, tiles.length), randInt(rng, tiles.length)];
      const saved = numbers.slice();
      if (x !== y && rng() < 0.7) {
        const [[a1, b1], [a2, b2]] = [tiles[x], tiles[y]];
        [numbers[a1], numbers[b1], numbers[a2], numbers[b2]] = [saved[a2], saved[b2], saved[a1], saved[b1]];
      } else {
        const [a, b] = tiles[x];
        [numbers[a], numbers[b]] = [saved[b], saved[a]];
      }
      const d = startDoms(p);
      const s = fixpoint(d, propagators(p)) ? d.filter((m) => m === ANY).length : 999;
      if (s <= score) score = s;
      else numbers.splice(0, numbers.length, ...saved);
    }
    const res = solveLogic(p);
    if (res.solved && countSolutions(p) === 1) return p;
  }
}
