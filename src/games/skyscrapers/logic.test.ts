import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, generate, type SkyscrapersPuzzle, solveLogic, validate, VARIANTS, visible } from './logic';

const GRID = [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 2, 3];

/** All edge clues of GRID (a cyclic Latin square), or none. */
const puzzle = (full: boolean): SkyscrapersPuzzle => {
  const n = 4;
  const col = (c: number) => Array.from({ length: n }, (_, r) => GRID[r * n + c]);
  const row = (r: number) => GRID.slice(r * n, r * n + n);
  const maybe = (x: number) => (full ? x : 0);
  return {
    size: n,
    top: Array.from({ length: n }, (_, c) => maybe(visible(col(c)))),
    bottom: Array.from({ length: n }, (_, c) => maybe(visible(col(c).reverse()))),
    left: Array.from({ length: n }, (_, r) => maybe(visible(row(r)))),
    right: Array.from({ length: n }, (_, r) => maybe(visible(row(r).reverse()))),
    solution: GRID,
    variant: '4',
    seed: 0,
  };
};

describe('visible', () => {
  it('counts buildings not hidden by taller ones', () => {
    expect(visible([1, 2, 3, 4])).toBe(4);
    expect(visible([4, 3, 2, 1])).toBe(1);
    expect(visible([2, 1, 4, 3])).toBe(2);
    expect(visible([3, 1, 2, 4])).toBe(2);
  });
});

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('5', 42)).toEqual(generate('5', 42));
    expect(generate('5', 42).solution).not.toEqual(generate('5', 43).solution);
  });

  it('falls back to the default variant', () => {
    expect(generate('nope', 1).variant).toBe(DEFAULT_VARIANT);
  });

  for (const { id } of VARIANTS) {
    it(`variant ${id}: unique, logically solvable and consistent`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const p = generate(id, seed);
        const n = Number(id);
        expect(p.size).toBe(n);
        for (const side of [p.top, p.bottom, p.left, p.right]) {
          expect(side).toHaveLength(n);
          expect(side.every((x) => Number.isInteger(x) && x >= 0 && x <= n)).toBe(true);
        }
        expect(p.solution).toHaveLength(n * n);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, grid: p.solution });
        // Not every clue is given, and not all of them are the trivial 1s and Ns.
        const clues = [...p.top, ...p.bottom, ...p.left, ...p.right].filter(Boolean);
        expect(clues.length).toBeLessThan(4 * n);
        expect(clues.some((c) => c > 1 && c < n)).toBe(true);
      }
    }, 60_000);
  }
});

describe('validate', () => {
  it('accepts the solution and rejects a broken grid', () => {
    const p = puzzle(true);
    expect(validate(p, GRID)).toBe(true);
    const swapped = GRID.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(validate(p, swapped)).toBe(false);
  });

  it('rejects a Latin square that breaks a clue', () => {
    const p = puzzle(true);
    // Another Latin square: rows reversed.
    const other = [4, 3, 2, 1, 1, 4, 3, 2, 2, 1, 4, 3, 3, 2, 1, 4];
    expect(validate(p, other)).toBe(false);
    expect(validate(puzzle(false), other)).toBe(true);
  });

  it('rejects repeated heights', () => {
    expect(validate(puzzle(false), new Array(16).fill(1))).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('a 4 clue forces the row 1 2 3 4', () => {
    const p = { ...puzzle(false), left: [4, 0, 0, 0] };
    const { grid, solved } = solveLogic(p);
    expect(solved).toBe(false);
    expect(grid.slice(0, 4)).toEqual([1, 2, 3, 4]);
  });

  it('a 1 clue puts the tallest building next to the edge', () => {
    const p = { ...puzzle(false), top: [1, 0, 0, 0] };
    expect(solveLogic(p).grid[0]).toBe(4);
  });

  it('solves the full clue set', () => {
    expect(solveLogic(puzzle(true))).toEqual({ solved: true, grid: GRID });
    expect(countSolutions(puzzle(true))).toBe(1);
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    expect(countSolutions(puzzle(false))).toBe(2);
    expect(solveLogic(puzzle(false)).solved).toBe(false);
  });

  it('reports 0 for contradictory clues', () => {
    expect(countSolutions({ ...puzzle(false), left: [4, 0, 0, 0], right: [4, 0, 0, 0] })).toBe(0);
  });
});
