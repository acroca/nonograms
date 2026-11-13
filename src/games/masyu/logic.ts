/**
 * Masyu: draw one closed loop through the centres of grid cells, visiting every pearl.
 * - A black pearl is a turn, and the loop goes straight for at least one more cell on both sides of it.
 * - A white pearl is passed straight through, and the loop turns in at least one of the cells right before or after it.
 */
import { ANY, fixpoint, NO, probe, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

export const NONE = 0;
export const WHITE = 1;
export const BLACK = 2;

export interface MasyuPuzzle {
  size: number;
  /** Per cell: NONE, WHITE or BLACK. */
  pearls: number[];
  /** Per edge (see `edgeCount`): true = part of the loop. */
  solution: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string }[] = [
  { id: '6', label: '6×6' },
  { id: '7', label: '7×7' },
  { id: '8', label: '8×8' },
];
export const DEFAULT_VARIANT = '8';

/** Horizontal edges first (`r * (n - 1) + c` joins cell (r, c) and (r, c + 1)), then vertical ones (`n(n-1) + r * n + c`). */
export const edgeCount = (n: number): number => 2 * n * (n - 1);
export const hEdge = (n: number, r: number, c: number): number => r * (n - 1) + c;
export const vEdge = (n: number, r: number, c: number): number => n * (n - 1) + r * n + c;

/** Edges around a cell: [up, down, left, right], -1 where the board ends. */
export function cellEdges(n: number, i: number): [number, number, number, number] {
  const r = Math.floor(i / n);
  const c = i % n;
  return [r > 0 ? vEdge(n, r - 1, c) : -1, r < n - 1 ? vEdge(n, r, c) : -1, c > 0 ? hEdge(n, r, c - 1) : -1, c < n - 1 ? hEdge(n, r, c) : -1];
}

/** The cells joined by an edge. */
export function edgeCells(n: number, e: number): [number, number] {
  const nh = n * (n - 1);
  if (e < nh) {
    const [r, c] = [Math.floor(e / (n - 1)), e % (n - 1)];
    return [r * n + c, r * n + c + 1];
  }
  const [r, c] = [Math.floor((e - nh) / n), (e - nh) % n];
  return [r * n + c, (r + 1) * n + c];
}

type Shape = Pick<MasyuPuzzle, 'size' | 'pearls'>;

/** Cell reached from `i` by one step in direction k (0 up, 1 down, 2 left, 3 right), or -1. */
const STEP = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const step = (n: number, i: number, k: number): number => {
  const r = Math.floor(i / n) + STEP[k][0];
  const c = (i % n) + STEP[k][1];
  return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : -1;
};

function propagators(p: Shape): Propagator[] {
  const n = p.size;
  const props: Propagator[] = [];
  const edges = Array.from({ length: n * n }, (_, i) => cellEdges(n, i));
  const st = (d: Doms, e: number) => (e < 0 ? NO : d[e]);

  for (let i = 0; i < n * n; i++) {
    const es = edges[i].filter((e) => e >= 0);
    const must = p.pearls[i] !== NONE;
    // Every cell has 0 or 2 loop edges; pearls have 2.
    props.push((d) => {
      let yes = 0;
      const open: number[] = [];
      for (const e of es) {
        if (d[e] === YES) yes++;
        else if (d[e] === ANY) open.push(e);
      }
      if (yes > 2) return false;
      if (yes === 2) {
        for (const e of open) d[e] = NO;
        return true;
      }
      if (yes + open.length < 2) {
        if (must || yes === 1) return false;
        for (const e of open) d[e] = NO;
        return true;
      }
      if (yes === 1 && open.length === 1) d[open[0]] = YES;
      if (must && open.length + yes === 2) for (const e of open) d[e] = YES;
      return true;
    });
    const [u, dn, l, r] = edges[i];
    if (p.pearls[i] === BLACK) {
      // Turn: exactly one horizontal and one vertical edge.
      const exactlyOne = (d: Doms, a: number, b: number): boolean => {
        if (st(d, a) === NO) {
          if (b < 0 || !(d[b] & YES)) return false;
          d[b] = YES;
        }
        if (st(d, b) === NO) {
          if (a < 0 || !(d[a] & YES)) return false;
          d[a] = YES;
        }
        if (st(d, a) === YES && b >= 0) d[b] &= NO;
        if (st(d, b) === YES && a >= 0) d[a] &= NO;
        return true;
      };
      props.push((d) => exactlyOne(d, l, r) && exactlyOne(d, u, dn));
      // Straight on both sides: the edge beyond each neighbour must continue.
      [0, 1, 2, 3].forEach((k) => {
        const e1 = edges[i][k];
        if (e1 < 0) return;
        const j = step(n, i, k);
        const e2 = edges[j][k];
        props.push((d) => {
          if (e2 < 0) {
            d[e1] &= NO;
            return true;
          }
          if (d[e1] === YES) d[e2] &= YES;
          if (d[e2] === NO) d[e1] &= NO;
          return true;
        });
      });
    } else if (p.pearls[i] === WHITE) {
      props.push((d) => {
        const can = (a: number, b: number, c1: number, c2: number) =>
          a >= 0 && b >= 0 && d[a] & YES && d[b] & YES && st(d, c1) !== YES && st(d, c2) !== YES;
        const hOk = can(l, r, u, dn);
        const vOk = can(u, dn, l, r);
        if (!hOk && !vOk) return false;
        if (!hOk) {
          d[u] = d[dn] = YES;
          for (const e of [l, r]) if (e >= 0) d[e] &= NO;
        } else if (!vOk) {
          d[l] = d[r] = YES;
          for (const e of [u, dn]) if (e >= 0) d[e] &= NO;
        }
        // The loop turns before or after the pearl: the two edges beyond can't both be drawn.
        for (const [a, b, k1, k2] of [[l, r, 2, 3], [u, dn, 0, 1]]) {
          if (st(d, a) !== YES || st(d, b) !== YES) continue;
          const [ja, jb] = [step(n, i, k1), step(n, i, k2)];
          const [ea, eb] = [edges[ja][k1], edges[jb][k2]];
          if (ea >= 0 && eb >= 0) {
            if (d[ea] === YES) d[eb] &= NO;
            if (d[eb] === YES) d[ea] &= NO;
          }
        }
        return true;
      });
    }
  }

  // One loop only: a closed loop must be the whole answer, and a path can't close early.
  const pearlCells = p.pearls.flatMap((x, i) => (x ? [i] : []));
  props.push((d) => {
    const total = d.length;
    const deg = new Int8Array(n * n);
    const parent = Array.from({ length: n * n }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    let yesCount = 0;
    for (let e = 0; e < total; e++) {
      if (d[e] !== YES) continue;
      yesCount++;
      const [a, b] = edgeCells(n, e);
      deg[a]++;
      deg[b]++;
      parent[find(a)] = find(b);
    }
    if (yesCount === 0) return true;
    const size = new Map<number, number>();
    const ends = new Map<number, number[]>();
    for (let i = 0; i < n * n; i++) {
      if (deg[i] === 0) continue;
      const r = find(i);
      size.set(r, (size.get(r) ?? 0) + 1);
      if (deg[i] === 1) {
        if (!ends.has(r)) ends.set(r, []);
        ends.get(r)!.push(i);
      }
    }
    for (const [root, count] of size) {
      if (ends.has(root)) continue;
      // A cycle: nothing else may be drawn and every pearl must lie on it.
      if (count !== yesCount) return false;
      if (pearlCells.some((c) => deg[c] === 0 || find(c) !== root)) return false;
      for (let e = 0; e < total; e++) if (d[e] === ANY) d[e] = NO;
      return true;
    }
    for (const [root, pair] of ends) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      const e = [0, 1, 2, 3].map((k) => (step(n, a, k) === b ? edges[a][k] : -1)).find((x) => x >= 0);
      if (e === undefined || d[e] !== ANY) continue;
      const covers = size.get(root) === undefined ? false : [...size.values()].length === 1 && pearlCells.every((c) => deg[c] > 0 && find(c) === root);
      if (!covers) d[e] = NO;
    }
    return true;
  });
  return props;
}

const startDoms = (p: Shape): Doms => new Uint32Array(edgeCount(p.size)).fill(ANY);

/** Checks that `loop` (per edge) is a single closed loop through every pearl that follows the pearl rules. */
export function validate(p: Shape, loop: boolean[]): boolean {
  const n = p.size;
  if (loop.length !== edgeCount(n)) return false;
  const used = (e: number) => e >= 0 && loop[e];
  const deg = (i: number) => cellEdges(n, i).filter(used).length;
  let cells = 0;
  let start = -1;
  for (let i = 0; i < n * n; i++) {
    const dg = deg(i);
    if (dg !== 0 && dg !== 2) return false;
    if (dg === 2) {
      cells++;
      if (start < 0) start = i;
    } else if (p.pearls[i] !== NONE) return false;
  }
  if (start < 0) return false;
  // Walk the loop once.
  let count = 1;
  let prev = -1;
  let cur = step(n, start, [0, 1, 2, 3].find((k) => used(cellEdges(n, start)[k]))!);
  prev = start;
  while (cur !== start) {
    if (cur < 0 || ++count > cells) return false;
    const k = [0, 1, 2, 3].find((q) => used(cellEdges(n, cur)[q]) && step(n, cur, q) !== prev);
    if (k === undefined) return false;
    prev = cur;
    cur = step(n, cur, k);
  }
  if (count !== cells) return false;
  // Pearl rules.
  const straight = (i: number) => (used(cellEdges(n, i)[0]) && used(cellEdges(n, i)[1])) || (used(cellEdges(n, i)[2]) && used(cellEdges(n, i)[3]));
  for (let i = 0; i < n * n; i++) {
    const pearl = p.pearls[i];
    if (pearl === NONE) continue;
    const es = cellEdges(n, i);
    if (pearl === BLACK) {
      if (straight(i)) return false;
      for (let k = 0; k < 4; k++) {
        if (!used(es[k])) continue;
        const j = step(n, i, k);
        if (!used(cellEdges(n, j)[k])) return false;
      }
    } else {
      if (!straight(i)) return false;
      const dirs = used(es[0]) ? [0, 1] : [2, 3];
      const turns = dirs.some((k) => !used(cellEdges(n, step(n, i, k))[k]));
      if (!turns) return false;
    }
  }
  return true;
}

/**
 * Human-style solver (no guessing): the pearl, degree and one-loop deductions, plus one-step lookahead (assume an edge,
 * and rule it out if that leads to a contradiction). `loop` marks the edges known to be drawn.
 */
export function solveLogic(p: Shape): { solved: boolean; loop: boolean[] } {
  const d = startDoms(p);
  const props = propagators(p);
  let ok = fixpoint(d, props);
  if (ok && d.some((m) => m === ANY)) {
    const open = Array.from(d.keys()).filter((e) => d[e] === ANY);
    ok = probe(d, props, open);
  }
  const loop = Array.from(d, (m) => m === YES);
  return { solved: ok && d.every((m) => m === YES || m === NO) && validate(p, loop), loop };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/**
 * Grows a random region of cells (on an (n-1)×(n-1) grid) whose outline is one simple loop: the outside stays
 * connected and no 2×2 block touches itself only diagonally.
 */
function growRegion(rng: Rng, m: number): Uint8Array {
  const p = m + 2;
  const inR = new Uint8Array(p * p);
  const target = Math.round(m * m * (0.55 + 0.2 * rng()));
  inR[(randInt(rng, m) + 1) * p + randInt(rng, m) + 1] = 1;
  const queue = new Int16Array(p * p);
  const outsideConnected = (outside: number): boolean => {
    const seen = new Uint8Array(p * p);
    seen[0] = 1;
    queue[0] = 0;
    let head = 0;
    let tail = 1;
    while (head < tail) {
      const x = queue[head++];
      const r = Math.floor(x / p);
      const c = x % p;
      for (const y of [r > 0 ? x - p : -1, r < p - 1 ? x + p : -1, c > 0 ? x - 1 : -1, c < p - 1 ? x + 1 : -1]) {
        if (y >= 0 && !inR[y] && !seen[y]) {
          seen[y] = 1;
          queue[tail++] = y;
        }
      }
    }
    return tail === outside;
  };
  const diagonalTouch = (x: number): boolean => {
    for (const b of [x - p - 1, x - p, x - 1, x]) {
      const [a, q, c, d] = [inR[b], inR[b + 1], inR[b + p], inR[b + p + 1]];
      if (a === d && q === c && a !== q) return true;
    }
    return false;
  };
  const weight = [0, 6, 2, 0.5, 0.2];
  for (let size = 1; size < target; size++) {
    const cands: number[] = [];
    const weights: number[] = [];
    let sum = 0;
    for (let r = 1; r <= m; r++) {
      for (let c = 1; c <= m; c++) {
        const x = r * p + c;
        const nb = inR[x - p] + inR[x + p] + inR[x - 1] + inR[x + 1];
        if (inR[x] || nb === 0) continue;
        inR[x] = 1;
        if (!diagonalTouch(x) && outsideConnected(p * p - size - 1)) {
          cands.push(x);
          weights.push(weight[nb]);
          sum += weight[nb];
        }
        inR[x] = 0;
      }
    }
    if (cands.length === 0) break;
    let roll = rng() * sum;
    let i = 0;
    while (i < cands.length - 1 && (roll -= weights[i]) >= 0) i++;
    inR[cands[i]] = 1;
  }
  const region = new Uint8Array(m * m);
  for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) region[r * m + c] = inR[(r + 1) * p + c + 1];
  return region;
}

/** The loop (per edge) running along the outline of a region on the (n-1)×(n-1) grid of cells between our cells. */
function outline(n: number, region: Uint8Array): boolean[] {
  const m = n - 1;
  const inside = (r: number, c: number) => r >= 0 && r < m && c >= 0 && c < m && region[r * m + c] === 1;
  const loop = new Array<boolean>(edgeCount(n)).fill(false);
  for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) loop[hEdge(n, r, c)] = inside(r - 1, c) !== inside(r, c);
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) loop[vEdge(n, r, c)] = inside(r, c - 1) !== inside(r, c);
  return loop;
}

/** Cells where a pearl would be legal on this loop. */
function pearlSites(n: number, loop: boolean[]): { white: number[]; black: number[] } {
  const used = (e: number) => e >= 0 && loop[e];
  const white: number[] = [];
  const black: number[] = [];
  for (let i = 0; i < n * n; i++) {
    const es = cellEdges(n, i);
    if (es.filter(used).length !== 2) continue;
    const dirs = [0, 1, 2, 3].filter((k) => used(es[k]));
    const beyond = (k: number) => used(cellEdges(n, step(n, i, k))[k]);
    if ((dirs[0] === 0 && dirs[1] === 1) || (dirs[0] === 2 && dirs[1] === 3)) {
      if (dirs.some((k) => !beyond(k))) white.push(i);
    } else if (dirs.every(beyond)) {
      black.push(i);
    }
  }
  return { white, black };
}

/** Whether `region` (cells of an m×m grid) is connected, hole-free and has no diagonal-only contacts. */
function simpleRegion(region: Uint8Array, m: number): boolean {
  const p = m + 2;
  const inR = new Uint8Array(p * p);
  let count = 0;
  let first = -1;
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < m; c++) {
      if (!region[r * m + c]) continue;
      inR[(r + 1) * p + c + 1] = 1;
      count++;
      if (first < 0) first = (r + 1) * p + c + 1;
    }
  }
  if (count === 0) return false;
  for (let b = 0; b < p * p - p - 1; b++) {
    if (b % p === p - 1) continue;
    const [a, q, c, d] = [inR[b], inR[b + 1], inR[b + p], inR[b + p + 1]];
    if (a === d && q === c && a !== q) return false;
  }
  const flood = (start: number, want: number): number => {
    const seen = new Uint8Array(p * p);
    const stack = [start];
    seen[start] = 1;
    let reached = 0;
    while (stack.length > 0) {
      const x = stack.pop()!;
      reached++;
      const [r, c] = [Math.floor(x / p), x % p];
      for (const y of [r > 0 ? x - p : -1, r < p - 1 ? x + p : -1, c > 0 ? x - 1 : -1, c < p - 1 ? x + 1 : -1]) {
        if (y >= 0 && inR[y] === want && !seen[y]) {
          seen[y] = 1;
          stack.push(y);
        }
      }
    }
    return reached;
  };
  return flood(first, 1) === count && flood(0, 0) === p * p - count;
}

/** The puzzle with a pearl on every legal site of the loop of `region`. */
function fullPuzzle(n: number, region: Uint8Array): MasyuPuzzle {
  const loop = outline(n, region);
  const { white, black } = pearlSites(n, loop);
  const pearls = new Array<number>(n * n).fill(NONE);
  for (const i of white) pearls[i] = WHITE;
  for (const i of black) pearls[i] = BLACK;
  return { size: n, pearls, solution: loop, variant: '', seed: 0 };
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): MasyuPuzzle {
  const id = VARIANTS.some((v) => v.id === variant) ? variant : DEFAULT_VARIANT;
  const n = Number(id);
  const m = n - 1;
  const rng = mulberry32(seed);
  for (;;) {
    // Hill-climb the loop's region towards a full-pearl puzzle with one solution that plain deduction solves.
    let region = growRegion(rng, m);
    const score = (r: Uint8Array): { s: number; p: MasyuPuzzle } => {
      const p = fullPuzzle(n, r);
      const count = countSolutions(p, 6);
      if (count > 1) return { s: count, p };
      return { s: solveLogic(p).solved ? 1 : 1.5, p };
    };
    let cur = score(region);
    for (let iter = 0; iter < 400 && cur.s > 1; iter++) {
      const next = region.slice();
      const flips = 1 + (rng() < 0.3 ? 1 : 0);
      for (let f = 0; f < flips; f++) next[randInt(rng, m * m)] ^= 1;
      if (!simpleRegion(next, m)) continue;
      const cand = score(next);
      if (cand.s <= cur.s || rng() < 0.02) {
        region = next;
        cur = cand;
      }
    }
    if (cur.s !== 1) continue;
    const p = { ...cur.p, variant: id, seed };
    const sites = p.pearls.flatMap((x, i) => (x ? [i] : []));
    if (sites.length < n) continue;
    for (const i of shuffle(rng, sites)) {
      const keep = p.pearls[i];
      p.pearls[i] = NONE;
      if (!solveLogic(p).solved) p.pearls[i] = keep;
    }
    if (countSolutions(p) === 1) return p;
  }
}
