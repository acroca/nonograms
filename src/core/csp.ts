/**
 * A small constraint-propagation engine shared by the puzzle games that model a grid as variables with
 * bitmask domains (bit v set = value v still possible). Games supply propagators, which are the human-style
 * deductions; `fixpoint` runs them to exhaustion (the "logic solver"), and `search` adds backtracking on
 * top of them (the "counting solver").
 */
export type Doms = Uint32Array;
/** Prunes domains in place; returns false when it finds a contradiction. */
export type Propagator = (d: Doms) => boolean;

export const bit = (v: number): number => 1 << v;
export const popcount = (m: number): number => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};
export const isSingle = (m: number): boolean => m !== 0 && (m & (m - 1)) === 0;
/** Smallest value in a domain. */
export const lowest = (m: number): number => 31 - Math.clz32(m & -m);

/** Boolean variables: bit 0 = "no" (value 0), bit 1 = "yes" (value 1). */
export const NO = 1;
export const YES = 2;
export const ANY = 3;

/** Runs the propagators until nothing changes. Returns false on a contradiction. */
export function fixpoint(d: Doms, props: Propagator[]): boolean {
  const prev = new Uint32Array(d.length);
  for (;;) {
    prev.set(d);
    for (const p of props) if (!p(d)) return false;
    let same = true;
    for (let i = 0; i < d.length; i++) {
      if (d[i] === 0) return false;
      if (d[i] !== prev[i]) same = false;
    }
    if (same) return true;
  }
}

/**
 * One-step lookahead: tries every remaining value of the given variables (all by default) and removes the ones that
 * propagate to a contradiction. Repeats until nothing is removed. Returns false on a contradiction.
 */
export function probe(d: Doms, props: Propagator[], vars?: ArrayLike<number>): boolean {
  const n = vars ? vars.length : d.length;
  const copy = new Uint32Array(d.length);
  for (;;) {
    let progress = false;
    for (let k = 0; k < n; k++) {
      const i = vars ? vars[k] : k;
      if (isSingle(d[i])) continue;
      for (let v = 0; v < 32; v++) {
        if (!(d[i] & bit(v)) || isSingle(d[i])) continue;
        copy.set(d);
        copy[i] = bit(v);
        if (!fixpoint(copy, props)) {
          d[i] &= ~bit(v);
          progress = true;
        }
      }
      if (d[i] === 0) return false;
    }
    if (!progress) return true;
    if (!fixpoint(d, props)) return false;
  }
}

/**
 * Counts solutions up to `limit` by propagation plus branching on the smallest domain. `leaf` is the independent rule
 * checker applied to every fully decided assignment.
 */
export function search(d0: Doms, props: Propagator[], leaf: (values: number[]) => boolean, limit = 2): number {
  let count = 0;
  const go = (d: Doms): void => {
    if (!fixpoint(d, props)) return;
    let best = -1;
    let bestSize = 99;
    for (let i = 0; i < d.length; i++) {
      if (isSingle(d[i])) continue;
      const size = popcount(d[i]);
      if (size < bestSize) [best, bestSize] = [i, size];
    }
    if (best < 0) {
      if (leaf(Array.from(d, lowest))) count++;
      return;
    }
    for (let v = 0; v < 32 && count < limit; v++) {
      if (!(d[best] & bit(v))) continue;
      const next = d.slice();
      next[best] = bit(v);
      go(next);
    }
  };
  go(d0.slice());
  return count;
}

/** Boolean variables: the number of YES among `vars` lies in [lo, hi]. */
export const countBetween =
  (vars: number[], lo: number, hi = lo): Propagator =>
  (d) => {
    let yes = 0;
    let open = 0;
    for (const i of vars) {
      if (d[i] === YES) yes++;
      else if (d[i] === ANY) open++;
    }
    if (yes > hi || yes + open < lo) return false;
    if (open === 0) return true;
    if (yes === hi) {
      for (const i of vars) if (d[i] === ANY) d[i] = NO;
    } else if (yes + open === lo) {
      for (const i of vars) if (d[i] === ANY) d[i] = YES;
    }
    return true;
  };

/**
 * All variables take different values; when as many values as variables remain, each value also has a place
 * (hidden singles). `values` is the mask of values the group must cover (default: as many as there are variables).
 */
export const allDifferent =
  (vars: number[], cover = false): Propagator =>
  (d) => {
    let fixed = 0;
    for (const i of vars) {
      if (!isSingle(d[i])) continue;
      if (fixed & d[i]) return false;
      fixed |= d[i];
    }
    if (fixed) {
      for (const i of vars) if (!isSingle(d[i])) d[i] &= ~fixed;
    }
    if (!cover) return true;
    let union = 0;
    for (const i of vars) union |= d[i];
    if (popcount(union) < vars.length) return false;
    if (popcount(union) > vars.length) return true;
    for (let v = 0; v < 32; v++) {
      if (!(union & bit(v))) continue;
      let only = -1;
      let places = 0;
      for (const i of vars) {
        if (d[i] & bit(v)) {
          places++;
          only = i;
        }
      }
      if (places === 1) d[only] = bit(v);
    }
    return true;
  };

/**
 * The variables whose domain still allows `yesBit` must form one connected group (over `adj`): variables that
 * are definitely in must be mutually reachable, unreachable ones are ruled out, and a variable whose removal
 * would split the definite ones apart is forced in. Boolean variables with `yesBit` = 1 by default.
 */
export const connectedGroup =
  (adj: number[][], yesBit = 1): Propagator =>
  (d) => {
    const n = d.length;
    const yes = bit(yesBit);
    const may = (i: number) => (d[i] & yes) !== 0;
    const must = (i: number) => d[i] === yes;
    let root = -1;
    let mustTotal = 0;
    for (let i = 0; i < n; i++) {
      if (must(i)) {
        mustTotal++;
        if (root < 0) root = i;
      }
    }
    if (root < 0) return true;
    const disc = new Int32Array(n).fill(-1);
    const low = new Int32Array(n);
    const sub = new Int32Array(n);
    const forced: number[] = [];
    let time = 0;
    const dfs = (u: number, parent: number): void => {
      disc[u] = low[u] = time++;
      sub[u] = must(u) ? 1 : 0;
      let separated = 0;
      let parts = 0;
      for (const v of adj[u]) {
        if (!may(v)) continue;
        if (disc[v] < 0) {
          dfs(v, u);
          sub[u] += sub[v];
          low[u] = Math.min(low[u], low[v]);
          if (low[v] >= disc[u] && sub[v] > 0) {
            separated += sub[v];
            parts++;
          }
        } else if (v !== parent) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
      if (!must(u)) {
        const rest = mustTotal - separated;
        if (parts + (rest > 0 ? 1 : 0) >= 2) forced.push(u);
      }
    };
    dfs(root, -1);
    for (let i = 0; i < n; i++) {
      if (must(i) && disc[i] < 0) return false;
    }
    for (let i = 0; i < n; i++) {
      if (disc[i] < 0 && may(i)) d[i] &= ~yes;
    }
    for (const u of forced) d[u] = yes;
    return true;
  };

/** Orthogonal neighbours of every cell of a rows × cols grid. */
export function gridNeighbours(rows: number, cols: number, diagonal = false): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const list: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if ((dr === 0 && dc === 0) || (!diagonal && dr !== 0 && dc !== 0)) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) list.push(rr * cols + cc);
        }
      }
      out.push(list);
    }
  }
  return out;
}
