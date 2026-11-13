/**
 * Battleships: find a hidden fleet from the number of ship cells in every row and column and a few revealed cells.
 * Ships are straight lines of 1..4 cells, and no two ships touch, not even diagonally. The fleet is known.
 */
import { ANY, countBetween, fixpoint, NO, search, YES, type Doms, type Propagator } from '../../core/csp';
import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

/** What a revealed cell shows. */
export const UNKNOWN = 0;
export const WATER = 1;
export const SINGLE = 2;
export const TOP = 3;
export const BOTTOM = 4;
export const LEFT = 5;
export const RIGHT = 6;
export const MIDDLE = 7;

export interface BattleshipsPuzzle {
  size: number;
  /** `fleet[k]` = number of ships of length k + 1. */
  fleet: number[];
  rowCounts: number[];
  colCounts: number[];
  /** Revealed cells (see the constants above), row-major. */
  givens: number[];
  /** Row-major, true = ship. */
  solution: boolean[];
  variant: string;
  seed: number;
}

export const VARIANTS: { id: string; label: string; size: number; fleet: number[] }[] = [
  { id: '6', label: '6×6', size: 6, fleet: [3, 2, 1, 0] },
  { id: '8', label: '8×8', size: 8, fleet: [3, 2, 2, 1] },
  { id: '10', label: '10×10', size: 10, fleet: [4, 3, 2, 1] },
];
export const DEFAULT_VARIANT = '8';

type Shape = Pick<BattleshipsPuzzle, 'size' | 'fleet' | 'rowCounts' | 'colCounts' | 'givens'>;

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function propagators(p: Shape): Propagator[] {
  const { size: n, fleet } = p;
  const at = (r: number, c: number) => (r >= 0 && r < n && c >= 0 && c < n ? r * n + c : -1);
  const props: Propagator[] = [];
  for (let k = 0; k < n; k++) {
    props.push(countBetween(Array.from({ length: n }, (_, c) => k * n + c), p.rowCounts[k]));
    props.push(countBetween(Array.from({ length: n }, (_, r) => r * n + k), p.colCounts[k]));
  }
  // Ships are straight and never touch: a ship cell has no ship on its diagonals, and not on both axes.
  props.push((d) => {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        if (d[i] !== YES) continue;
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const j = at(r + dr, c + dc);
          if (j >= 0) {
            if (d[j] === YES) return false;
            d[j] &= NO;
          }
        }
        const [u, dn, l, rt] = DIRS.map(([dr, dc]) => at(r + dr, c + dc));
        const horiz = (l >= 0 && d[l] === YES) || (rt >= 0 && d[rt] === YES);
        const vert = (u >= 0 && d[u] === YES) || (dn >= 0 && d[dn] === YES);
        if (horiz && vert) return false;
        if (horiz) for (const j of [u, dn]) if (j >= 0) d[j] &= NO;
        if (vert) for (const j of [l, rt]) if (j >= 0) d[j] &= NO;
      }
    }
    return true;
  });
  // A revealed middle piece continues along one axis.
  p.givens.forEach((g, i) => {
    if (g !== MIDDLE) return;
    const r = Math.floor(i / n);
    const c = i % n;
    const [u, dn, l, rt] = DIRS.map(([dr, dc]) => at(r + dr, c + dc));
    const st = (d: Doms, j: number) => (j < 0 ? NO : d[j]);
    props.push((d) => {
      const hOk = st(d, l) & st(d, rt) & YES && st(d, u) !== YES && st(d, dn) !== YES;
      const vOk = st(d, u) & st(d, dn) & YES && st(d, l) !== YES && st(d, rt) !== YES;
      if (!hOk && !vOk) return false;
      if (!hOk) {
        for (const j of [u, dn]) d[j] = YES;
        for (const j of [l, rt]) if (j >= 0) d[j] = NO;
      }
      if (!vOk) {
        for (const j of [l, rt]) d[j] = YES;
        for (const j of [u, dn]) if (j >= 0) d[j] = NO;
      }
      return true;
    });
  });
  // Runs of known ship cells: the ship they belong to must fit the fleet that is left.
  const lines: number[][] = [];
  for (let k = 0; k < n; k++) {
    lines.push(Array.from({ length: n }, (_, c) => k * n + c), Array.from({ length: n }, (_, r) => r * n + k));
  }
  props.push((d) => {
    const closed = (j: number) => j < 0 || d[j] === NO;
    // Completed ships so far, by length.
    const done = new Array<number>(n + 2).fill(0);
    for (let i = 0; i < n * n; i++) {
      if (d[i] !== YES) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      const [u, dn, l, rt] = DIRS.map(([dr, dc]) => at(r + dr, c + dc));
      const horiz = (l >= 0 && d[l] === YES) || (rt >= 0 && d[rt] === YES);
      const vert = (u >= 0 && d[u] === YES) || (dn >= 0 && d[dn] === YES);
      if (!horiz && !vert) {
        if (closed(u) && closed(dn) && closed(l) && closed(rt)) done[1]++;
        continue;
      }
      // Count each run once, at its first cell.
      if (horiz && !(l >= 0 && d[l] === YES)) {
        let e = c;
        while (e + 1 < n && d[r * n + e + 1] === YES) e++;
        if (closed(at(r, c - 1)) && closed(at(r, e + 1))) done[e - c + 1]++;
      }
      if (vert && !(u >= 0 && d[u] === YES)) {
        let e = r;
        while (e + 1 < n && d[(e + 1) * n + c] === YES) e++;
        if (closed(at(r - 1, c)) && closed(at(e + 1, c))) done[e - r + 1]++;
      }
    }
    for (let k = 1; k <= n; k++) if (done[k] > (fleet[k - 1] ?? 0)) return false;
    const room = (k: number, own: boolean) => k >= 1 && k <= fleet.length && (fleet[k - 1] ?? 0) - done[k] + (own ? 1 : 0) > 0;
    /** Segments [x, y] of a line that could be the ship containing the run [s, e]. */
    const feasible = (line: number[], s: number, e: number, perp: number[][], own: boolean): [number, number][] => {
      const out: [number, number][] = [];
      for (let x = s; x >= 0 && d[line[x]] !== NO; x--) {
        for (let y = e; y < n && d[line[y]] !== NO; y++) {
          const k = y - x + 1;
          if (k > fleet.length) break;
          if (x > 0 && d[line[x - 1]] === YES) continue;
          if (y < n - 1 && d[line[y + 1]] === YES) continue;
          const isRun = x === s && y === e;
          if (!room(k, own && isRun && k === e - s + 1)) continue;
          let ok = true;
          for (let m = x; m <= y && ok; m++) for (const j of perp[m]) if (j >= 0 && d[j] === YES) ok = false;
          if (ok) out.push([x, y]);
        }
      }
      return out;
    };
    const perpRow = (r: number) => Array.from({ length: n }, (_, c) => [at(r - 1, c), at(r + 1, c)]);
    const perpCol = (c: number) => Array.from({ length: n }, (_, r) => [at(r, c - 1), at(r, c + 1)]);
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const k0 = Math.floor(li / 2);
      const perp = li % 2 === 0 ? perpRow(k0) : perpCol(k0);
      for (let s = 0; s < n; s++) {
        if (d[line[s]] !== YES || (s > 0 && d[line[s - 1]] === YES)) continue;
        let e = s;
        while (e + 1 < n && d[line[e + 1]] === YES) e++;
        const len = e - s + 1;
        // Is this run a completed ship already?
        const own = (s === 0 || d[line[s - 1]] === NO) && (e === n - 1 || d[line[e + 1]] === NO);
        if (len === 1) {
          // Direction unknown: look along both lines.
          const i = line[s];
          const r = Math.floor(i / n);
          const c = i % n;
          if (li % 2 === 1) continue; // handled with the row pass
          const rowSegs = feasible(line, s, e, perp, own);
          const colLine = Array.from({ length: n }, (_, q) => q * n + c);
          const colSegs = feasible(colLine, r, r, perpCol(c), own);
          const all = [...rowSegs.map((g) => ['h', g] as const), ...colSegs.map((g) => ['v', g] as const)];
          if (all.length === 0) return false;
          const act = (j: number, possible: boolean, forced: boolean) => {
            if (j < 0) return;
            if (!possible) d[j] &= NO;
            else if (forced) d[j] &= YES;
          };
          const ext = (dir: 'h' | 'v', side: -1 | 1) => (g: readonly [string, [number, number]]) =>
            g[0] === dir && (side < 0 ? g[1][0] < (dir === 'h' ? c : r) : g[1][1] > (dir === 'h' ? c : r));
          const sides: [number, 'h' | 'v', -1 | 1][] = [[at(r, c - 1), 'h', -1], [at(r, c + 1), 'h', 1], [at(r - 1, c), 'v', -1], [at(r + 1, c), 'v', 1]];
          for (const [j, dir, side] of sides) {
            const f = ext(dir, side);
            act(j, all.some(f), all.every(f));
          }
          continue;
        }
        const segs = feasible(line, s, e, perp, own);
        if (segs.length === 0) return false;
        const before = s > 0 ? line[s - 1] : -1;
        const after = e < n - 1 ? line[e + 1] : -1;
        if (before >= 0) {
          if (segs.every(([x]) => x === s)) d[before] &= NO;
          else if (segs.every(([x]) => x < s)) d[before] &= YES;
        }
        if (after >= 0) {
          if (segs.every(([, y]) => y === e)) d[after] &= NO;
          else if (segs.every(([, y]) => y > e)) d[after] &= YES;
        }
      }
    }
    return true;
  });
  return props;
}

function startDoms(p: Shape): Doms {
  const n = p.size;
  const d = new Uint32Array(n * n).fill(ANY);
  const set = (r: number, c: number, v: number) => {
    if (r >= 0 && r < n && c >= 0 && c < n) d[r * n + c] &= v;
  };
  p.givens.forEach((g, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    if (g === UNKNOWN) return;
    if (g === WATER) {
      d[i] = NO;
      return;
    }
    d[i] = YES;
    // Which of the four neighbours (up, down, left, right) continue the ship.
    const goes: Record<number, number[]> = { [SINGLE]: [0, 0, 0, 0], [TOP]: [0, 1, 0, 0], [BOTTOM]: [1, 0, 0, 0], [LEFT]: [0, 0, 0, 1], [RIGHT]: [0, 0, 1, 0] };
    const want = goes[g];
    if (!want) return;
    DIRS.forEach(([dr, dc], k) => {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) return;
      set(rr, cc, want[k] ? YES : NO);
    });
  });
  return d;
}

/** Checks that `grid` (true = ship) is a complete, valid solution. */
export function validate(p: Shape, grid: boolean[]): boolean {
  const { size: n, fleet } = p;
  if (grid.length !== n * n) return false;
  const at = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n && grid[r * n + c];
  for (let k = 0; k < n; k++) {
    let row = 0;
    let col = 0;
    for (let m = 0; m < n; m++) {
      if (grid[k * n + m]) row++;
      if (grid[m * n + k]) col++;
    }
    if (row !== p.rowCounts[k] || col !== p.colCounts[k]) return false;
  }
  // Ships: orthogonal components that are straight; no diagonal contact.
  const seen = new Set<number>();
  const found = new Array<number>(fleet.length + 1).fill(0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!grid[r * n + c]) continue;
      if (at(r - 1, c - 1) || at(r - 1, c + 1)) return false;
      if (seen.has(r * n + c)) continue;
      const comp = [r * n + c];
      seen.add(r * n + c);
      for (let q = 0; q < comp.length; q++) {
        const [cr, cc] = [Math.floor(comp[q] / n), comp[q] % n];
        for (const [dr, dc] of DIRS) {
          if (at(cr + dr, cc + dc) && !seen.has((cr + dr) * n + cc + dc)) {
            seen.add((cr + dr) * n + cc + dc);
            comp.push((cr + dr) * n + cc + dc);
          }
        }
      }
      const rows = new Set(comp.map((i) => Math.floor(i / n)));
      const cols = new Set(comp.map((i) => i % n));
      if (rows.size > 1 && cols.size > 1) return false;
      if (comp.length > fleet.length) return false;
      found[comp.length]++;
    }
  }
  if (!fleet.every((count, k) => found[k + 1] === count)) return false;
  // Revealed cells.
  return p.givens.every((g, i) => {
    if (g === UNKNOWN) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    if (g === WATER) return !grid[i];
    if (!grid[i]) return false;
    const [u, dn, l, rt] = DIRS.map(([dr, dc]) => at(r + dr, c + dc));
    switch (g) {
      case SINGLE: return !u && !dn && !l && !rt;
      case TOP: return !u && dn && !l && !rt;
      case BOTTOM: return u && !dn && !l && !rt;
      case LEFT: return !l && rt && !u && !dn;
      case RIGHT: return l && !rt && !u && !dn;
      default: return (l && rt) || (u && dn);
    }
  });
}

/** Human-style solver (no guessing). `known[i]` is 1 for ship, 0 for water, -1 while undecided. */
export function solveDomains(p: Shape): { ok: boolean; known: number[] } {
  const d = startDoms(p);
  const ok = fixpoint(d, propagators(p));
  return { ok, known: Array.from(d, (m) => (m === YES ? 1 : m === NO ? 0 : -1)) };
}

export function solveLogic(p: Shape): { solved: boolean; ships: boolean[] } {
  const { ok, known } = solveDomains(p);
  const ships = known.map((v) => v === 1);
  return { solved: ok && known.every((v) => v >= 0) && validate(p, ships), ships };
}

/** Counts solutions (up to `limit`) by propagation plus backtracking. */
export function countSolutions(p: Shape, limit = 2): number {
  return search(startDoms(p), propagators(p), (v) => validate(p, v.map((x) => x === 1)), limit);
}

/** Random non-touching placement of the whole fleet. */
function placeFleet(rng: Rng, n: number, fleet: number[]): boolean[] | null {
  const grid = new Array<boolean>(n * n).fill(false);
  const lengths = fleet.flatMap((count, k) => Array<number>(count).fill(k + 1)).sort((a, b) => b - a);
  const free = (r: number, c: number) => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && grid[rr * n + cc]) return false;
      }
    }
    return true;
  };
  for (const len of lengths) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const horiz = rng() < 0.5;
      const r = randInt(rng, horiz ? n : n - len + 1);
      const c = randInt(rng, horiz ? n - len + 1 : n);
      const cells = Array.from({ length: len }, (_, k) => (horiz ? r * n + c + k : (r + k) * n + c));
      if (!cells.every((i) => free(Math.floor(i / n), i % n))) continue;
      cells.forEach((i) => (grid[i] = true));
      placed = true;
    }
    if (!placed) return null;
  }
  return grid;
}

/** What a revealed ship cell looks like in `ships`. */
function pieceAt(n: number, ships: boolean[], i: number): number {
  const r = Math.floor(i / n);
  const c = i % n;
  const at = (rr: number, cc: number) => rr >= 0 && rr < n && cc >= 0 && cc < n && ships[rr * n + cc];
  const [u, dn, l, rt] = DIRS.map(([dr, dc]) => at(r + dr, c + dc));
  if (!u && !dn && !l && !rt) return SINGLE;
  if (dn && !u) return TOP;
  if (u && !dn && !l && !rt) return BOTTOM;
  if (rt && !l) return LEFT;
  if (l && !rt) return RIGHT;
  return MIDDLE;
}

/** Generates a puzzle with a unique solution that `solveLogic` solves completely. Deterministic per (variant, seed). */
export function generate(variant: string, seed: number): BattleshipsPuzzle {
  const v = VARIANTS.find((x) => x.id === variant) ?? VARIANTS.find((x) => x.id === DEFAULT_VARIANT)!;
  const n = v.size;
  const rng = mulberry32(seed);
  for (;;) {
    const ships = placeFleet(rng, n, v.fleet);
    if (!ships) continue;
    const rowCounts = Array.from({ length: n }, (_, r) => ships.slice(r * n, r * n + n).filter(Boolean).length);
    const colCounts = Array.from({ length: n }, (_, c) => ships.filter((s, i) => s && i % n === c).length);
    const p: BattleshipsPuzzle = { size: n, fleet: v.fleet, rowCounts, colCounts, givens: new Array(n * n).fill(UNKNOWN), solution: ships, variant: v.id, seed };
    const reveal = (i: number) => (p.givens[i] = ships[i] ? pieceAt(n, ships, i) : WATER);
    // Reveal cells the solver can't decide until it can.
    let guard = 0;
    while (guard++ < n * n) {
      const { ok, known } = solveDomains(p);
      if (!ok) break;
      const open = known.flatMap((k, i) => (k < 0 ? [i] : []));
      if (open.length === 0) break;
      reveal(open[randInt(rng, open.length)]);
    }
    if (!solveLogic(p).solved) continue;
    // Thin the revealed cells again.
    for (const i of shuffle(rng, p.givens.flatMap((g, k) => (g ? [k] : [])))) {
      const keep = p.givens[i];
      p.givens[i] = UNKNOWN;
      if (!solveLogic(p).solved) p.givens[i] = keep;
    }
    if (p.givens.some(Boolean) && countSolutions(p) === 1) return p;
  }
}
