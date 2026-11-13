/**
 * Numberlink: connect every pair of equal numbers with a path along the grid. Paths never cross or share cells, and
 * together they cover every cell of the grid.
 */
import { ANY, countBetween, fixpoint, NO, probe, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';
import { cellEdges, edgeCells, edgeCount } from '../masyu/logic';

export interface NumberlinkPuzzle {
  size: number;
  /** Number of pairs. */
  pairs: number;
  /** Per cell: 0, or the pair number (1..pairs) of an endpoint. */
  ends: number[];
  /** Per cell: the pair number of the path through it (endpoints included). */
  solution: number[];
  /** Per edge (horizontal first, see masyu `edgeCount`): true = the path continues across it. */
  links: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '5', label: '5×5' },
  { id: '6', label: '6×6' },
  { id: '7', label: '7×7' },
];
export const DEFAULT_VARIANT = '6';

type Shape = Pick<NumberlinkPuzzle, 'size' | 'pairs' | 'ends'>;

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const props: Propagator[] = [];
  for (let i = 0; i < n * n; i++) {
    props.push(countBetween(cellEdges(n, i).filter((e) => e >= 0), p.ends[i] ? 1 : 2));
  }
  const total = edgeCount(n);
  const ends = Array.from({ length: total }, (_, e) => edgeCells(n, e));
  // Partial paths: never close a loop, never join two different pairs.
  props.push((d) => {
    const parent = Array.from({ length: n * n }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (let e = 0; e < total; e++) if (d[e] === YES) parent[find(ends[e][0])] = find(ends[e][1]);
    const colour = new Int16Array(n * n);
    for (let i = 0; i < n * n; i++) {
      if (!p.ends[i]) continue;
      const r = find(i);
      if (colour[r] && colour[r] !== p.ends[i] && colour[r] > 0) return false;
      if (colour[r] === 0) colour[r] = p.ends[i];
    }
    for (let e = 0; e < total; e++) {
      if (d[e] !== ANY) continue;
      const [ra, rb] = [find(ends[e][0]), find(ends[e][1])];
      if (ra === rb) d[e] = NO;
      else if (colour[ra] && colour[rb] && colour[ra] !== colour[rb]) d[e] = NO;
    }
    return true;
  });
  return props;
}

const startDoms = (p: Shape): Doms => new Uint32Array(edgeCount(p.size)).fill(ANY);

/** The pair number of each cell's path for a drawn set of links, or null if they don't form a valid answer. */
export function coloursOf(p: Shape, links: boolean[]): number[] | null {
  const n = p.size;
  if (links.length !== edgeCount(n)) return null;
  const colours = new Array<number>(n * n).fill(0);
  const nbrs = (i: number) => cellEdges(n, i).flatMap((e) => (e >= 0 && links[e] ? [edgeCells(n, e).find((c) => c !== i)!] : []));
  for (let i = 0; i < n * n; i++) {
    if (nbrs(i).length !== (p.ends[i] ? 1 : 2)) return null;
  }
  for (let k = 1; k <= p.pairs; k++) {
    const [a, b] = p.ends.flatMap((x, i) => (x === k ? [i] : []));
    if (b === undefined) return null;
    let prev = -1;
    let cur = a;
    for (let steps = 0; steps <= n * n; steps++) {
      if (colours[cur]) return null;
      colours[cur] = k;
      if (cur === b) break;
      const next = nbrs(cur).find((c) => c !== prev);
      if (next === undefined) return null;
      [prev, cur] = [cur, next];
    }
    if (cur !== b) return null;
  }
  return colours.every(Boolean) ? colours : null;
}

/** Checks that `links` (per edge) draws a valid complete answer. */
export function validate(p: Shape, links: boolean[]): boolean {
  return coloursOf(p, links) !== null;
}

/**
 * Human-style solver (no guessing): every cell has its path's two neighbours, no closed loops, no joining different
 * pairs, plus one-step lookahead. `links` marks the edges known to be part of a path.
 */
export function solveLogic(p: Shape, lookahead = true): { solved: boolean; links: boolean[] } {
  const d = startDoms(p);
  const props = propagators(p);
  let ok = fixpoint(d, props);
  if (ok && lookahead && d.some((m) => m === ANY)) ok = probe(d, props);
  const links = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate(p, links), links };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/** A random Hamiltonian path of the n×n grid (snake path shuffled by "backbite" moves). */
function hamiltonianPath(rng: Rng, n: number): number[] {
  let path: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) path.push(r * n + (r % 2 ? n - 1 - c : c));
  const near = (i: number) => {
    const [r, c] = [Math.floor(i / n), i % n];
    return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((x) => x >= 0);
  };
  for (let move = 0; move < n * n * 30; move++) {
    if (rng() < 0.5) path.reverse();
    const x = near(path[0])[randInt(rng, near(path[0]).length)];
    const j = path.indexOf(x);
    if (j > 1) path = [...path.slice(0, j).reverse(), ...path.slice(j)];
  }
  return path;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): NumberlinkPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const path = hamiltonianPath(rng, n);
    const pairs = Math.round(n * (0.9 + 0.5 * rng()));
    // Cut the path into `pairs` pieces of at least two cells.
    const cuts = shuffle(rng, Array.from({ length: n * n - 3 }, (_, i) => i + 2)).slice(0, pairs - 1).sort((a, b) => a - b);
    if (cuts.some((c, k) => k > 0 && c - cuts[k - 1] < 2)) continue;
    const bounds = [0, ...cuts, n * n];
    const solution = new Array<number>(n * n).fill(0);
    const ends = new Array<number>(n * n).fill(0);
    const links = new Array<boolean>(edgeCount(n)).fill(false);
    const edgeIndex = new Map(Array.from({ length: edgeCount(n) }, (_, e) => [edgeCells(n, e).join(':'), e] as const));
    for (let k = 0; k < pairs; k++) {
      const piece = path.slice(bounds[k], bounds[k + 1]);
      piece.forEach((cell, m) => {
        solution[cell] = k + 1;
        if (m > 0) links[edgeIndex.get([piece[m - 1], cell].sort((a, b) => a - b).join(':'))!] = true;
      });
      ends[piece[0]] = ends[piece[piece.length - 1]] = k + 1;
    }
    const p: NumberlinkPuzzle = { size: n, pairs, ends, solution, links, variant: id, seed };
    // Cheap filter first: skip layouts the plain deductions barely dent before spending time on lookahead.
    const d = startDoms(p);
    if (!fixpoint(d, propagators(p)) || d.filter((m) => m === ANY).length > edgeCount(n) * 0.3) continue;
    if (solveLogic(p).solved && countSolutions(p) === 1) return p;
  }
}
