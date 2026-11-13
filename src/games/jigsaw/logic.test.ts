import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, generate, groupsOf, type JigsawPuzzle, solveLogic, validate, VARIANTS } from './logic';

/** 4×4 with ordinary 2×2 boxes as regions, and a cyclic-Latin solution. */
const BOXES = [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 3, 3];
const SOLUTION = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
const puzzle = (givens: number[]): JigsawPuzzle => ({ size: 4, regions: BOXES, givens, solution: SOLUTION, variant: '4', seed: 0 });

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('6', 42)).toEqual(generate('6', 42));
    expect(generate('6', 42).regions).not.toEqual(generate('6', 43).regions);
  });

  it('falls back to the default variant', () => {
    expect(generate('nope', 1).variant).toBe(DEFAULT_VARIANT);
  });

  for (const { id } of VARIANTS) {
    it(`variant ${id}: unique, logically solvable and consistent`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const p = generate(id, seed);
        const n = Number(id);
        expect(p.size).toBe(n);
        expect(p.regions).toHaveLength(n * n);
        // n regions of n cells each.
        for (let g = 0; g < n; g++) expect(p.regions.filter((r) => r === g)).toHaveLength(n);
        expect(p.givens.every((g, i) => g === 0 || g === p.solution[i])).toBe(true);
        expect(p.givens.some((g) => g === 0)).toBe(true);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, grid: p.solution });
      }
    }, 120_000);
  }
});

describe('groupsOf', () => {
  it('lists rows, columns and regions', () => {
    const groups = groupsOf(4, BOXES);
    expect(groups).toHaveLength(12);
    expect(groups[0]).toEqual([0, 1, 2, 3]);
    expect(groups[1]).toEqual([0, 4, 8, 12]);
    expect(groups.some((g) => g.slice().sort((a, b) => a - b).join() === '0,1,4,5')).toBe(true);
  });
});

describe('validate', () => {
  it('accepts the solution', () => {
    expect(validate(puzzle(new Array(16).fill(0)), SOLUTION)).toBe(true);
  });

  it('rejects a repeat in a row, column or region', () => {
    const rowClash = SOLUTION.slice();
    rowClash[1] = 1;
    expect(validate(puzzle(new Array(16).fill(0)), rowClash)).toBe(false);
    // Rows and columns are fine here but the top-left region repeats a digit.
    const other = [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1].slice();
    other[5] = 2;
    expect(validate(puzzle(new Array(16).fill(0)), other)).toBe(false);
  });

  it('rejects a grid that contradicts a given or has the wrong size', () => {
    expect(validate(puzzle([2, ...new Array(15).fill(0)]), SOLUTION)).toBe(false);
    expect(validate(puzzle(new Array(16).fill(0)), SOLUTION.slice(1))).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('fills in cells with only one candidate', () => {
    const givens = SOLUTION.map((v, i) => ([0, 1, 5].includes(i) ? 0 : v));
    expect(countSolutions(puzzle(givens))).toBe(1);
    expect(solveLogic(puzzle(givens))).toEqual({ solved: true, grid: SOLUTION });
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    const p = puzzle(new Array(16).fill(0));
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p, false).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(puzzle([1, 1, ...new Array(14).fill(0)]))).toBe(0);
  });
});
