import { mulberry32, randInt, shuffle, type Rng } from '../../core/rng';

/**
 * Sudoku on an N×N grid (4×4, 6×6 or the classic 9×9). Cells are row-major (`i = r * N + c`); digits are 1..N and
 * 0 means empty.
 */
export interface SudokuPuzzle {
  /** N×N entries: the clue digit, or 0 for a cell the player fills in. */
  givens: number[];
  /** N×N digits: the unique solution. */
  solution: number[];
  variant: string;
  seed: number;
}

/** The 9×9 variants keep their original ids (difficulties) so older saves and best times stay valid. */
export const VARIANTS: { id: string; label: string }[] = [
  { id: '4', label: '4×4' },
  { id: '6', label: '6×6' },
  { id: 'easy', label: '9×9 Easy' },
  { id: 'medium', label: '9×9 Medium' },
  { id: 'hard', label: '9×9 Hard' },
];
export const DEFAULT_VARIANT = 'easy';

/** Supported grid sizes and their box shape (rows × columns). */
export const BOXES: Record<number, [number, number]> = { 4: [2, 2], 6: [2, 3], 9: [3, 3] };

/** Grid side of a puzzle (older saves have 81 cells). */
export const sizeOf = (puzzle: { givens: ArrayLike<number> }): number => Math.round(Math.sqrt(puzzle.givens.length));

/**
 * Technique levels of the logic solver:
 * 1 = naked/hidden singles;
 * 2 = + locked candidates (pointing/claiming), naked/hidden pairs;
 * 3 = + naked/hidden triples, X-Wing, Swordfish, XY-Wing.
 */
export type Level = 1 | 2 | 3;
export const LEVELS: Record<string, Level> = { easy: 1, medium: 2, hard: 3 };

/** Precomputed layout of one grid size. */
export interface Geometry {
  size: number;
  cells: number;
  /** Bitmask of every digit 1..size. */
  all: number;
  /** The 3·size units (rows, then columns, then boxes), each listing its cells. */
  units: number[][];
  boxOf: (i: number) => number;
  peers: number[][];
  isPeer: Uint8Array;
}

const GEOMETRIES = new Map<number, Geometry>();

function geometry(size: number): Geometry {
  const cached = GEOMETRIES.get(size);
  if (cached) return cached;
  if (!BOXES[size]) throw new Error(`Unsupported Sudoku size: ${size}`);
  const [bh, bw] = BOXES[size];
  const cells = size * size;
  const units: number[][] = [];
  for (let r = 0; r < size; r++) units.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) units.push(Array.from({ length: size }, (_, r) => r * size + c));
  for (let b = 0; b < size; b++) {
    const r0 = Math.floor(b / (size / bw)) * bh;
    const c0 = (b % (size / bw)) * bw;
    units.push(Array.from({ length: size }, (_, k) => (r0 + Math.floor(k / bw)) * size + c0 + (k % bw)));
  }
  const boxOf = (i: number): number => Math.floor(Math.floor(i / size) / bh) * (size / bw) + Math.floor((i % size) / bw);
  const peers: number[][] = [];
  const isPeer = new Uint8Array(cells * cells);
  for (let i = 0; i < cells; i++) {
    const set = new Set([...units[Math.floor(i / size)], ...units[size + (i % size)], ...units[2 * size + boxOf(i)]]);
    set.delete(i);
    peers.push([...set].sort((a, b) => a - b));
    for (const p of set) isPeer[i * cells + p] = 1;
  }
  const g: Geometry = { size, cells, all: (1 << size) - 1, units, boxOf, peers, isPeer };
  GEOMETRIES.set(size, g);
  return g;
}

/** The cells sharing a row, column or box with cell `i` (20 on a 9×9 grid). */
export function peers(i: number, size = 9): number[] {
  return geometry(size).peers[i].slice();
}

const POP = new Uint8Array(0x200);
for (let m = 1; m < 0x200; m++) POP[m] = POP[m >> 1] + (m & 1);
const bitOf = (d: number): number => 1 << (d - 1);
const digitOf = (bit: number): number => 32 - Math.clz32(bit);

/** Calls `fn` with every k-subset of `items` (reusing one array); stops early when `fn` returns true. */
function someCombination<T>(items: T[], k: number, fn: (combo: T[]) => boolean): boolean {
  const combo: T[] = [];
  const rec = (start: number): boolean => {
    if (combo.length === k) return fn(combo);
    for (let j = start; j <= items.length - (k - combo.length); j++) {
      combo.push(items[j]);
      if (rec(j + 1)) return true;
      combo.pop();
    }
    return false;
  };
  return rec(0);
}

// ---------------------------------------------------------------------------
// Logic solver
// ---------------------------------------------------------------------------

/**
 * Pencil-mark state of the logic solver. `cand[i]` is a bitmask of the digits still possible in cell i
 * (bit d-1 for digit d); a placed cell keeps just its own bit. `bad` flags a contradiction.
 */
export interface SolverState {
  g: Geometry;
  value: Uint8Array;
  cand: Uint16Array;
  filled: number;
  bad: boolean;
}

/** A state with no digits placed and every candidate open (handy for testing single techniques). */
export function emptyState(size = 9): SolverState {
  const g = geometry(size);
  return { g, value: new Uint8Array(g.cells), cand: new Uint16Array(g.cells).fill(g.all), filled: 0, bad: false };
}

function place(s: SolverState, i: number, d: number): void {
  const bit = bitOf(d);
  if (!(s.cand[i] & bit)) s.bad = true;
  s.value[i] = d;
  s.cand[i] = bit;
  s.filled++;
  for (const p of s.g.peers[i]) {
    if (s.cand[p] & bit) {
      s.cand[p] &= ~bit;
      if (!s.cand[p]) s.bad = true;
    }
  }
}

/** Removes the digits in `mask` from cell i's candidates; returns whether anything changed. */
function eliminate(s: SolverState, i: number, mask: number): boolean {
  if (!(s.cand[i] & mask)) return false;
  s.cand[i] &= ~mask;
  if (!s.cand[i]) s.bad = true;
  return true;
}

const open = (s: SolverState, i: number, bit: number): boolean => s.value[i] === 0 && (s.cand[i] & bit) !== 0;

function nakedSingles(s: SolverState): boolean {
  let progress = false;
  for (let i = 0; i < s.g.cells && !s.bad; i++) {
    if (s.value[i] === 0 && POP[s.cand[i]] === 1) {
      place(s, i, digitOf(s.cand[i]));
      progress = true;
    }
  }
  return progress;
}

function hiddenSingles(s: SolverState): boolean {
  let progress = false;
  for (const unit of s.g.units) {
    let once = 0;
    let twice = 0;
    for (const i of unit) {
      twice |= once & s.cand[i];
      once |= s.cand[i];
    }
    if (once !== s.g.all) s.bad = true;
    if (s.bad) return progress;
    for (let only = once & ~twice; only; only &= only - 1) {
      const bit = only & -only;
      const i = unit.find((j) => s.cand[j] & bit)!;
      if (s.value[i] === 0) {
        place(s, i, digitOf(bit));
        progress = true;
      }
    }
  }
  return progress;
}

/**
 * Pointing: a digit confined to one row/column within a box is removed from the rest of that line.
 * Claiming: a digit confined to one box within a row/column is removed from the rest of that box.
 */
function lockedCandidates(s: SolverState): boolean {
  const { size, units, boxOf } = s.g;
  let progress = false;
  for (let u = 0; u < units.length; u++) {
    for (let d = 1; d <= size; d++) {
      const bit = bitOf(d);
      const cells = units[u].filter((i) => open(s, i, bit));
      if (cells.length < 2) continue;
      const targets: number[] = [];
      if (u >= 2 * size) {
        const r = Math.floor(cells[0] / size);
        const c = cells[0] % size;
        if (cells.every((i) => Math.floor(i / size) === r)) targets.push(r);
        if (cells.every((i) => i % size === c)) targets.push(size + c);
      } else {
        const b = boxOf(cells[0]);
        if (cells.every((i) => boxOf(i) === b)) targets.push(2 * size + b);
      }
      for (const t of targets) {
        for (const i of units[t]) {
          if (s.value[i] === 0 && !units[u].includes(i) && eliminate(s, i, bit)) progress = true;
        }
      }
    }
  }
  return progress;
}

/** Naked subset: k cells of a unit whose candidates together are just k digits own those digits. */
function nakedSubsets(s: SolverState, k: number): boolean {
  for (const unit of s.g.units) {
    const cells = unit.filter((i) => s.value[i] === 0 && POP[s.cand[i]] <= k);
    const found = someCombination(cells, k, (combo) => {
      const mask = combo.reduce((m, i) => m | s.cand[i], 0);
      if (POP[mask] !== k) return false;
      let progress = false;
      for (const i of unit) {
        if (s.value[i] === 0 && !combo.includes(i) && eliminate(s, i, mask)) progress = true;
      }
      return progress;
    });
    if (found) return true;
  }
  return false;
}

/** Hidden subset: k digits that fit in only the same k cells of a unit leave no room for other digits there. */
function hiddenSubsets(s: SolverState, k: number): boolean {
  for (const unit of s.g.units) {
    const where: number[] = [];
    const digits: number[] = [];
    for (let d = 1; d <= s.g.size; d++) {
      let pos = 0;
      unit.forEach((i, j) => {
        if (open(s, i, bitOf(d))) pos |= 1 << j;
      });
      where[d] = pos;
      if (POP[pos] >= 2 && POP[pos] <= k) digits.push(d);
    }
    const found = someCombination(digits, k, (combo) => {
      const pos = combo.reduce((m, d) => m | where[d], 0);
      if (POP[pos] !== k) return false;
      const others = s.g.all & ~combo.reduce((m, d) => m | bitOf(d), 0);
      let progress = false;
      unit.forEach((i, j) => {
        if (pos & (1 << j) && eliminate(s, i, others)) progress = true;
      });
      return progress;
    });
    if (found) return true;
  }
  return false;
}

/**
 * Fish of size k (2 = X-Wing, 3 = Swordfish): if in k rows a digit only fits in the same k columns, it must
 * occupy those columns in these rows, so it is removed from the rest of those columns (and vice versa).
 */
function fish(s: SolverState, k: number): boolean {
  const { size } = s.g;
  for (let d = 1; d <= size; d++) {
    const bit = bitOf(d);
    for (const byRow of [true, false]) {
      const cell = (line: number, x: number): number => (byRow ? line * size + x : x * size + line);
      const where: number[] = [];
      const lines: number[] = [];
      for (let line = 0; line < size; line++) {
        let pos = 0;
        for (let x = 0; x < size; x++) if (open(s, cell(line, x), bit)) pos |= 1 << x;
        where[line] = pos;
        if (POP[pos] >= 2 && POP[pos] <= k) lines.push(line);
      }
      const found = someCombination(lines, k, (base) => {
        const cover = base.reduce((m, line) => m | where[line], 0);
        if (POP[cover] !== k) return false;
        let progress = false;
        for (let line = 0; line < size; line++) {
          if (base.includes(line)) continue;
          for (let x = 0; x < size; x++) {
            if (cover & (1 << x) && s.value[cell(line, x)] === 0 && eliminate(s, cell(line, x), bit)) progress = true;
          }
        }
        return progress;
      });
      if (found) return true;
    }
  }
  return false;
}

/**
 * XY-Wing: a pivot {x,y} sees pincers {x,z} and {y,z}. Whichever digit the pivot takes, one pincer is z,
 * so z is removed from every cell seeing both pincers.
 */
function xyWing(s: SolverState): boolean {
  const { cells, peers, isPeer } = s.g;
  for (let pivot = 0; pivot < cells; pivot++) {
    const pm = s.cand[pivot];
    if (s.value[pivot] !== 0 || POP[pm] !== 2) continue;
    const wings = peers[pivot].filter((p) => s.value[p] === 0 && POP[s.cand[p]] === 2 && POP[s.cand[p] & pm] === 1);
    for (const a of wings) {
      const z = s.cand[a] & ~pm;
      for (const b of wings) {
        if (b <= a || s.cand[b] !== (z | (pm & ~s.cand[a]))) continue;
        let progress = false;
        for (const c of peers[a]) {
          if (c !== b && s.value[c] === 0 && isPeer[b * cells + c] && eliminate(s, c, z)) progress = true;
        }
        if (progress) return true;
      }
    }
  }
  return false;
}

/** The individual techniques, exposed for unit tests. Each applies itself once and returns whether it made progress. */
export const technique = { nakedSingles, hiddenSingles, lockedCandidates, nakedSubsets, hiddenSubsets, fish, xyWing };

/** Techniques from simplest to hardest. */
const TECHNIQUES: { level: Level; apply: (s: SolverState) => boolean }[] = [
  { level: 1, apply: nakedSingles },
  { level: 1, apply: hiddenSingles },
  { level: 2, apply: lockedCandidates },
  { level: 2, apply: (s) => nakedSubsets(s, 2) },
  { level: 2, apply: (s) => hiddenSubsets(s, 2) },
  { level: 3, apply: (s) => nakedSubsets(s, 3) },
  { level: 3, apply: (s) => hiddenSubsets(s, 3) },
  { level: 3, apply: (s) => fish(s, 2) },
  { level: 3, apply: (s) => fish(s, 3) },
  { level: 3, apply: xyWing },
];

/**
 * Runs the techniques up to `maxLevel`, restarting from the simplest one after any progress. Since this is
 * deterministic, a run only deviates from a lower-level run once that one is stuck, so `level` (the hardest
 * level that made progress) tells exactly which levels can solve the puzzle.
 */
function runLogic(givens: ArrayLike<number>, maxLevel: Level): { state: SolverState; level: Level } {
  const s = emptyState(sizeOf({ givens }));
  for (let i = 0; i < s.g.cells && !s.bad; i++) if (givens[i]) place(s, i, givens[i]);
  let level: Level = 1;
  while (!s.bad && s.filled < s.g.cells) {
    const t = TECHNIQUES.find((t) => t.level <= maxLevel && t.apply(s));
    if (!t) break;
    if (t.level > level) level = t.level;
  }
  return { state: s, level };
}

/**
 * Solves using human techniques only (no guessing) up to `maxLevel` (default: all). When `solved` is true the
 * solution is unique; otherwise `grid` holds the digits deduced so far (0 = unknown).
 */
export function solveLogic(puzzle: { givens: number[] }, maxLevel: Level = 3): { solved: boolean; grid: number[] } {
  const { state } = runLogic(puzzle.givens, maxLevel);
  return { solved: !state.bad && state.filled === state.g.cells, grid: Array.from(state.value) };
}

// ---------------------------------------------------------------------------
// Backtracking (solution counting and full-grid generation)
// ---------------------------------------------------------------------------

/**
 * Depth-first search over digit bitmasks, branching on the empty cell with the fewest options (so forced cells
 * are filled first). Calls `onSolution` for each complete grid and stops once it returns true. With `rng`,
 * digits are tried in random order. Clashing givens yield no solutions.
 */
function search(grid: Uint8Array, onSolution: () => boolean, rng?: Rng): void {
  const { size, cells, all, boxOf } = geometry(sizeOf({ givens: grid }));
  const rows = new Uint16Array(size);
  const cols = new Uint16Array(size);
  const boxes = new Uint16Array(size);
  for (let i = 0; i < cells; i++) {
    if (!grid[i]) continue;
    const bit = bitOf(grid[i]);
    const [r, c, b] = [Math.floor(i / size), i % size, boxOf(i)];
    if ((rows[r] | cols[c] | boxes[b]) & bit) return;
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }
  const rec = (): boolean => {
    let best = -1;
    let bestMask = 0;
    for (let i = 0; i < cells; i++) {
      if (grid[i]) continue;
      const mask = all & ~(rows[Math.floor(i / size)] | cols[i % size] | boxes[boxOf(i)]);
      if (!mask) return false;
      if (best < 0 || POP[mask] < POP[bestMask]) {
        best = i;
        bestMask = mask;
        if (POP[mask] === 1) break;
      }
    }
    if (best < 0) return onSolution();
    const [r, c, b] = [Math.floor(best / size), best % size, boxOf(best)];
    const digits: number[] = [];
    for (let m = bestMask; m; m &= m - 1) digits.push(digitOf(m & -m));
    if (rng) shuffle(rng, digits);
    for (const d of digits) {
      const bit = bitOf(d);
      grid[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      const stop = rec();
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      if (stop) return true;
    }
    grid[best] = 0;
    return false;
  };
  rec();
}

/** Whether a complete grid has each digit 1..N exactly once in every row, column and box. */
function followsRules(grid: ArrayLike<number>): boolean {
  const size = sizeOf({ givens: grid });
  if (!BOXES[size] || grid.length !== size * size) return false;
  const { cells, units } = geometry(size);
  for (let i = 0; i < cells; i++) if (!Number.isInteger(grid[i]) || grid[i] < 1 || grid[i] > size) return false;
  return units.every((unit) => new Set(unit.map((i) => grid[i])).size === size);
}

/** Counts solutions by propagation + backtracking, stopping as soon as `limit` are found. */
export function countSolutions(puzzle: { givens: ArrayLike<number> }, limit = 2): number {
  let count = 0;
  const grid = Uint8Array.from(puzzle.givens);
  search(grid, () => {
    if (followsRules(grid)) count++;
    return count >= limit;
  });
  return count;
}

/** Whether `grid` is a complete, valid Sudoku that keeps all of the puzzle's givens. */
export function validate(puzzle: { givens: number[] }, grid: number[]): boolean {
  return followsRules(grid) && (!puzzle.givens.length || puzzle.givens.length === grid.length) && puzzle.givens.every((g, i) => g === 0 || g === grid[i]);
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Recipe {
  /** Grid side. */
  size: number;
  level: Level;
  /** Inclusive range the target clue count is drawn from. */
  clues: [number, number];
  /** Never go below this many clues. */
  floor: number;
  /** The hardest technique level the puzzle must need (all lower levels must fail). */
  needs: Level;
}

const RECIPES: Record<string, Recipe> = {
  '4': { size: 4, level: 1, clues: [5, 7], floor: 5, needs: 1 },
  '6': { size: 6, level: 2, clues: [12, 15], floor: 12, needs: 1 },
  easy: { size: 9, level: 1, clues: [36, 42], floor: 36, needs: 1 },
  medium: { size: 9, level: 2, clues: [28, 34], floor: 28, needs: 2 },
  hard: { size: 9, level: 3, clues: [23, 27], floor: 23, needs: 3 },
};
/** Attempts that keep 180° rotational symmetry before also removing single clues. */
const SYMMETRIC_TRIES = 25;
/** Hard attempts that must need a level-3 technique before settling for anything beyond singles. */
const HARD_TRIES = 60;

/**
 * Removes clues in random order, first in 180°-symmetric pairs and then (unless `symmetric`) one by one, keeping
 * only removals that leave the solution unique (fast counter first) and the logic solver able to finish at the
 * recipe's level. Stops once the target clue count is reached and the puzzle needs `needs`-level techniques;
 * returns null if that never happens.
 */
function dig(rng: Rng, solution: Uint8Array, recipe: Recipe, needs: Level, symmetric: boolean): Uint8Array | null {
  const cells = solution.length;
  const grid = solution.slice();
  const puzzle = { givens: grid };
  const [lo, hi] = recipe.clues;
  const target = lo + randInt(rng, hi - lo + 1);
  const half = Array.from({ length: Math.ceil(cells / 2) }, (_, i) => (i === cells - 1 - i ? [i] : [i, cells - 1 - i]));
  const groups = shuffle(rng, half);
  if (!symmetric) groups.push(...shuffle(rng, Array.from({ length: cells }, (_, i) => [i])));
  let clues = cells;
  let level = 1;
  for (const group of groups) {
    if (clues - group.length < recipe.floor || group.some((i) => !grid[i])) continue;
    for (const i of group) grid[i] = 0;
    const run = countSolutions(puzzle) === 1 ? runLogic(grid, recipe.level) : null;
    if (!run || run.state.bad || run.state.filled < cells) {
      for (const i of group) grid[i] = solution[i];
      continue;
    }
    clues -= group.length;
    level = run.level;
    if (clues <= target && level >= needs) return grid;
  }
  return clues <= hi && level >= needs ? grid : null;
}

/**
 * Generates a puzzle with a unique solution that the logic solver finishes at the variant's level: 4×4 and easy
 * need only singles; 6×6 may also use locked candidates or pairs; medium needs locked candidates or pairs; hard
 * needs triples, fish or an XY-Wing (falling back to anything beyond singles if many attempts fail). Unknown variants are generated as the default one.
 */
export function generate(variant: string, seed: number): SudokuPuzzle {
  const id = variant in RECIPES ? variant : DEFAULT_VARIANT;
  const recipe = RECIPES[id];
  const rng = mulberry32(seed);
  for (let attempt = 0; ; attempt++) {
    const solution = new Uint8Array(recipe.size * recipe.size);
    search(solution, () => true, rng);
    const needs = recipe.needs === 3 && attempt >= HARD_TRIES ? 2 : recipe.needs;
    const givens = dig(rng, solution, recipe, needs, attempt < SYMMETRIC_TRIES);
    if (givens) return { givens: Array.from(givens), solution: Array.from(solution), variant: id, seed };
  }
}
