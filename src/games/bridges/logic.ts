/**
 * Bridges: numbered islands sit on a grid. Join them with horizontal or vertical bridges (one or two between a pair)
 * so that every island has exactly as many bridges as its number, bridges never cross each other or an island, and all
 * islands end up connected.
 */
import { bit, fixpoint, highest, lowest, search, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

export interface BridgesPuzzle {
  size: number;
  /** Island cells (row-major index), ascending. */
  cells: number[];
  /** Island numbers (1..8), parallel to `cells`. */
  numbers: number[];
  /** Possible bridges: pairs of island indices that face each other in a row or column with no island between. */
  edges: [number, number][];
  /** Bridges (0, 1 or 2) per edge. */
  solution: number[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '7', label: '7×7' },
  { id: '9', label: '9×9' },
  { id: '11', label: '11×11' },
];
export const DEFAULT_VARIANT = '9';

/** Pairs of facing islands (index into `cells`) in a size × size grid. */
export function edgesOf(size: number, cells: number[]): [number, number][] {
  const at = new Map(cells.map((c, k) => [c, k]));
  const out: [number, number][] = [];
  cells.forEach((cell, k) => {
    const r = Math.floor(cell / size);
    const c = cell % size;
    for (let cc = c + 1; cc < size; cc++) {
      const other = at.get(r * size + cc);
      if (other !== undefined) {
        out.push([k, other]);
        break;
      }
    }
    for (let rr = r + 1; rr < size; rr++) {
      const other = at.get(rr * size + c);
      if (other !== undefined) {
        out.push([k, other]);
        break;
      }
    }
  });
  return out;
}

/** Whether two edges cross (one horizontal, one vertical, meeting strictly inside both). */
export function crosses(size: number, cells: number[], a: [number, number], b: [number, number]): boolean {
  const pos = (k: number) => [Math.floor(cells[k] / size), cells[k] % size];
  const [[ar1, ac1], [ar2, ac2]] = [pos(a[0]), pos(a[1])];
  const [[br1, bc1], [br2, bc2]] = [pos(b[0]), pos(b[1])];
  const aHoriz = ar1 === ar2;
  const bHoriz = br1 === br2;
  if (aHoriz === bHoriz) return false;
  const [h, v] = aHoriz ? [[ar1, ac1, ac2], [bc1, br1, br2]] : [[br1, bc1, bc2], [ac1, ar1, ar2]];
  const [row, c1, c2] = h;
  const [col, r1, r2] = v;
  return col > Math.min(c1, c2) && col < Math.max(c1, c2) && row > Math.min(r1, r2) && row < Math.max(r1, r2);
}

type Shape = Pick<BridgesPuzzle, 'size' | 'cells' | 'numbers' | 'edges'>;

function propagators(p: Shape): Propagator[] {
  const count = p.cells.length;
  const incident: number[][] = Array.from({ length: count }, () => []);
  p.edges.forEach(([a, b], e) => {
    incident[a].push(e);
    incident[b].push(e);
  });
  const props: Propagator[] = [];
  // Each island's bridges add up to its number.
  for (let k = 0; k < count; k++) {
    const es = incident[k];
    const want = p.numbers[k];
    props.push((d) => {
      let lo = 0;
      let hi = 0;
      for (const e of es) {
        lo += lowest(d[e]);
        hi += highest(d[e]);
      }
      if (lo > want || hi < want) return false;
      for (const e of es) {
        const min = want - (hi - highest(d[e]));
        const max = want - (lo - lowest(d[e]));
        for (let v = 0; v <= 2; v++) if (v < min || v > max) d[e] &= ~bit(v);
      }
      return true;
    });
  }
  // Crossing bridges exclude each other.
  const pairs: [number, number][] = [];
  for (let e = 0; e < p.edges.length; e++) {
    for (let f = e + 1; f < p.edges.length; f++) if (crosses(p.size, p.cells, p.edges[e], p.edges[f])) pairs.push([e, f]);
  }
  props.push((d) => {
    for (const [e, f] of pairs) {
      if (!(d[e] & 1)) d[f] &= 1;
      if (!(d[f] & 1)) d[e] &= 1;
    }
    return true;
  });
  // Islands must end up in one group: a group with no way out of it is a dead end, one way out is forced.
  props.push((d) => {
    const parent = Array.from({ length: count }, (_, k) => k);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    p.edges.forEach(([a, b], e) => {
      if (!(d[e] & 1)) parent[find(a)] = find(b);
    });
    const roots = new Set(parent.map((_, k) => find(k)));
    if (roots.size === 1) return true;
    const exits = new Map<number, number[]>();
    p.edges.forEach(([a, b], e) => {
      if (d[e] === 1) return;
      const [ra, rb] = [find(a), find(b)];
      if (ra === rb) return;
      for (const r of [ra, rb]) {
        if (!exits.has(r)) exits.set(r, []);
        exits.get(r)!.push(e);
      }
    });
    for (const r of roots) {
      const out = exits.get(r) ?? [];
      if (out.length === 0) return false;
      if (out.length === 1) d[out[0]] &= ~1;
    }
    return true;
  });
  return props;
}

const startDoms = (p: Shape): Doms => new Uint32Array(p.edges.length).fill(7);

/** Checks that `bridges` (a count per edge) is a complete, valid solution. */
export function validate(p: Shape, bridges: number[]): boolean {
  const count = p.cells.length;
  if (bridges.length !== p.edges.length || bridges.some((v) => !Number.isInteger(v) || v < 0 || v > 2)) return false;
  const degree = new Array<number>(count).fill(0);
  p.edges.forEach(([a, b], e) => {
    degree[a] += bridges[e];
    degree[b] += bridges[e];
  });
  if (degree.some((dg, k) => dg !== p.numbers[k])) return false;
  const used = p.edges.flatMap((e, k) => (bridges[k] > 0 ? [e] : []));
  for (let i = 0; i < used.length; i++) {
    for (let j = i + 1; j < used.length; j++) if (crosses(p.size, p.cells, used[i], used[j])) return false;
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length > 0) {
    const k = stack.pop()!;
    for (const [a, b] of used) {
      const other = a === k ? b : b === k ? a : -1;
      if (other >= 0 && !seen.has(other)) {
        seen.add(other);
        stack.push(other);
      }
    }
  }
  return seen.size === count;
}

/** Human-style solver (no guessing). `bridges` has the known bridge count per edge (-1 while undecided). */
export function solveLogic(p: Shape): { solved: boolean; bridges: number[] } {
  const d = startDoms(p);
  const ok = fixpoint(d, propagators(p));
  const known = Array.from(d, (m) => (m === 1 || m === 2 || m === 4 ? lowest(m) : -1));
  return { solved: ok && known.every((v) => v >= 0) && validate(p, known), bridges: known };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v), limit);
}

/** Grows a random connected island structure; returns island cells and bridge counts per (cell, cell) pair. */
function grow(rng: Rng, n: number, target: number): { cells: number[]; links: Map<string, number> } | null {
  const owner = new Int16Array(n * n).fill(-1); // island index
  const wire = new Uint8Array(n * n); // 1 = horizontal bridge, 2 = vertical bridge on this cell
  const cells: number[] = [randInt(rng, n * n)];
  owner[cells[0]] = 0;
  const links = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const touchesIsland = (r: number, c: number, skip: number) =>
    dirs.some(([dr, dc]) => {
      const rr = r + dr;
      const cc = c + dc;
      return rr >= 0 && rr < n && cc >= 0 && cc < n && owner[rr * n + cc] >= 0 && rr * n + cc !== skip;
    });
  for (let tries = 0; cells.length < target && tries < target * 60; tries++) {
    const from = randInt(rng, cells.length);
    const [dr, dc] = dirs[randInt(rng, 4)];
    const r0 = Math.floor(cells[from] / n);
    const c0 = cells[from] % n;
    const flag = dr === 0 ? 1 : 2;
    const options: number[] = [];
    for (let s = 1; ; s++) {
      const r = r0 + dr * s;
      const c = c0 + dc * s;
      if (r < 0 || r >= n || c < 0 || c >= n || owner[r * n + c] >= 0 || wire[r * n + c]) break;
      if (s >= 2 && !touchesIsland(r, c, -1)) options.push(s);
    }
    if (options.length === 0) continue;
    const s = options[randInt(rng, options.length)];
    const cell = (r0 + dr * s) * n + c0 + dc * s;
    for (let k = 1; k < s; k++) wire[(r0 + dr * k) * n + c0 + dc * k] = flag;
    owner[cell] = cells.length;
    links.set(key(cells[from], cell), rng() < 0.35 ? 2 : 1);
    cells.push(cell);
  }
  if (cells.length < target) return null;
  // Extra bridges between facing islands whose gap is still free.
  for (const a of shuffle(rng, cells.slice())) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r0 = Math.floor(a / n);
      const c0 = a % n;
      const flag = dr === 0 ? 1 : 2;
      for (let s = 1; ; s++) {
        const r = r0 + dr * s;
        const c = c0 + dc * s;
        if (r >= n || c >= n) break;
        const here = r * n + c;
        if (owner[here] >= 0) {
          const k = key(a, here);
          if (!links.has(k) && rng() < 0.3) {
            for (let m = 1; m < s; m++) wire[(r0 + dr * m) * n + c0 + dc * m] = flag;
            links.set(k, rng() < 0.3 ? 2 : 1);
          }
          break;
        }
        if (wire[here]) break;
      }
    }
  }
  return { cells, links };
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): BridgesPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const rng = mulberry32(seed);
  for (;;) {
    const target = Math.round(n * n * (0.2 + 0.07 * rng()));
    const g = grow(rng, n, target);
    if (!g) continue;
    const order = g.cells.map((_, k) => k).sort((a, b) => g.cells[a] - g.cells[b]);
    const cells = order.map((k) => g.cells[k]);
    const edges = edgesOf(n, cells);
    const solution = edges.map(([a, b]) => g.links.get(cells[a] < cells[b] ? `${cells[a]}:${cells[b]}` : `${cells[b]}:${cells[a]}`) ?? 0);
    const numbers = cells.map(() => 0);
    edges.forEach(([a, b], e) => {
      numbers[a] += solution[e];
      numbers[b] += solution[e];
    });
    if (numbers.some((x) => x > 8)) continue;
    const p: BridgesPuzzle = { size: n, cells, numbers, edges, solution, variant: id, seed };
    if (solveLogic(p).solved && countSolutions(p) === 1) return p;
  }
}
