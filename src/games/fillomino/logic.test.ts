import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, type FillominoPuzzle, generate, solveLogic, validate, VARIANTS } from './logic';

const puzzle = (n: number, givens: number[], max = n): FillominoPuzzle => ({ size: n, maxValue: max, givens, solution: [], variant: String(n), seed: 0 });

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('5', 42)).toEqual(generate('5', 42));
    expect(generate('5', 42).solution).not.toEqual(generate('5', 43).solution);
  });

  it('falls back to the default variant', () => {
    expect(generate('nope', 1).variant).toBe(DEFAULT_VARIANT);
  });

  for (const { id, size, max } of VARIANTS) {
    it(`variant ${id}: unique, logically solvable and consistent`, () => {
      for (let seed = 1; seed <= 10; seed++) {
        const p = generate(id, seed);
        expect(p.size).toBe(size);
        expect(p.maxValue).toBe(max);
        expect(p.solution).toHaveLength(size * size);
        expect(p.solution.every((v) => v >= 1 && v <= max)).toBe(true);
        expect(p.givens.every((g, i) => g === 0 || g === p.solution[i])).toBe(true);
        // Some cells are left blank, but not all.
        const given = p.givens.filter(Boolean).length;
        expect(given).toBeGreaterThan(0);
        expect(given).toBeLessThan(size * size * 0.7);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, grid: p.solution });
      }
    }, 120_000);
  }
});

describe('validate', () => {
  const none = new Array(9).fill(0);

  it('accepts a valid 3×3 and rejects broken groups', () => {
    const good = [1, 2, 2, 3, 3, 3, 1, 2, 2];
    // groups: (0,0)=1 size 1; 2s at (0,1),(0,2) size 2; 3s at (1,0),(1,1),(1,2) size 3; (2,0)=1 size 1; 2s at (2,1),(2,2) size 2
    expect(validate(puzzle(3, none, 3), good)).toBe(true);
    expect(validate(puzzle(3, none, 3), [1, 2, 2, 3, 3, 3, 1, 2, 3])).toBe(false);
    expect(validate(puzzle(3, none, 3), [1, 2, 2, 3, 3, 3, 1, 1, 2])).toBe(false);
  });

  it('rejects grids that contradict a given or have the wrong size', () => {
    const good = [1, 2, 2, 3, 3, 3, 1, 2, 2];
    expect(validate(puzzle(3, [2, 0, 0, 0, 0, 0, 0, 0, 0], 3), good)).toBe(false);
    expect(validate(puzzle(3, none, 3), good.slice(1))).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('a closed group leaves its neighbours alone, and a short group must grow', () => {
    // 3×3 with a 1 in the corner: its neighbours can't be 1; the 3 in the centre needs two more cells.
    const p = puzzle(3, [1, 0, 0, 0, 3, 0, 0, 0, 0], 3);
    const { grid } = solveLogic(p);
    expect(grid[0]).toBe(1);
    expect(grid[1]).not.toBe(1);
  });

  it('solves a stored puzzle', () => {
    const solution = [1, 2, 2, 3, 3, 3, 1, 2, 2];
    const p = puzzle(3, [1, 0, 2, 3, 0, 0, 1, 0, 2], 3);
    expect(countSolutions(p)).toBe(1);
    expect(solveLogic(p)).toEqual({ solved: true, grid: solution });
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    const p = puzzle(3, new Array(9).fill(0), 3);
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    // Two adjacent givens of 1 would form a group of two.
    expect(countSolutions(puzzle(3, [1, 1, 0, 0, 0, 0, 0, 0, 0], 3))).toBe(0);
  });
});
