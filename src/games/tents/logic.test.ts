import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, generate, solveLogic, validate, VARIANTS, type TentsPuzzle } from './logic';

/** Builds a puzzle from rows: `T` tree, `A` tent (the solution), `.` grass. Counts are derived from the tents. */
const parse = (rows: string[]): TentsPuzzle => {
  const n = rows.length;
  const cells = rows.join('').split('');
  const solution = cells.map((ch) => ch === 'A');
  return {
    size: n,
    trees: cells.map((ch) => ch === 'T'),
    rowCounts: rows.map((row) => row.split('').filter((ch) => ch === 'A').length),
    colCounts: Array.from({ length: n }, (_, c) => rows.filter((row) => row[c] === 'A').length),
    solution,
    variant: String(n),
    seed: 0,
  };
};

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('8', 42)).toEqual(generate('8', 42));
    expect(generate('8', 42).trees).not.toEqual(generate('8', 43).trees);
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
        expect(p.trees).toHaveLength(n * n);
        expect(p.solution).toHaveLength(n * n);
        expect(p.solution.filter(Boolean)).toHaveLength(p.trees.filter(Boolean).length);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, tents: p.solution });
      }
    }, 60_000);
  }
});

describe('validate', () => {
  const p = parse(['TA.T', '...A', '.T..', '.A..']);

  it('accepts the intended layout', () => {
    expect(validate(p, p.solution)).toBe(true);
  });

  it('rejects tents that touch diagonally', () => {
    const q = parse(['TA..', '.TA.', '....', '....']);
    expect(validate(q, q.solution)).toBe(false);
  });

  it('rejects wrong row counts', () => {
    const grid = p.solution.slice();
    grid[1] = false;
    grid[2] = true;
    expect(validate(p, grid)).toBe(false);
  });

  it('rejects a tent on a tree', () => {
    const grid = p.solution.slice();
    grid[0] = true;
    grid[1] = false;
    expect(validate(p, grid)).toBe(false);
  });

  it('requires a one-to-one matching of trees and tents', () => {
    // The tent between the two trees serves only one of them; the other tent has no tree at all.
    const q = parse(['TAT', '...', 'A..']);
    expect(validate(q, q.solution)).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('solves a puzzle by counts, tree adjacency and non-touching', () => {
    const p = parse(['TA.T', '...A', '.T..', '.A..']);
    expect(countSolutions(p)).toBe(1);
    expect(solveLogic(p)).toEqual({ solved: true, tents: p.solution });
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    // Trees stacked in column 1: the tents are either (0,0) + (1,2) or (0,2) + (1,0).
    const p: TentsPuzzle = {
      size: 4,
      trees: [false, true, false, false, false, true, false, false, false, false, false, false, false, false, false, false],
      rowCounts: [1, 1, 0, 0],
      colCounts: [1, 0, 1, 0],
      solution: [],
      variant: '4',
      seed: 0,
    };
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    const p = parse(['TA.T', '...A', '.T..', '.A..']);
    expect(countSolutions({ ...p, rowCounts: [2, 1, 0, 0] })).toBe(0);
  });
});
