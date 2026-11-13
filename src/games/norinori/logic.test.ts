import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, generate, type NorinoriPuzzle, solveLogic, validate, VARIANTS } from './logic';

/** Rows of region letters; the solution is empty. */
const puzzle = (rows: string[]): NorinoriPuzzle => {
  const letters = [...new Set(rows.join(''))];
  return {
    size: rows.length,
    regions: rows.join('').split('').map((ch) => letters.indexOf(ch)),
    solution: [],
    variant: String(rows.length),
    seed: 0,
  };
};

const shade = (n: number, cells: number[]): boolean[] => {
  const grid = new Array<boolean>(n * n).fill(false);
  cells.forEach((i) => (grid[i] = true));
  return grid;
};

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('5', 42)).toEqual(generate('5', 42));
    expect(generate('5', 42).regions).not.toEqual(generate('5', 43).regions);
  });

  it('falls back to the default variant', () => {
    expect(generate('nope', 1).variant).toBe(DEFAULT_VARIANT);
  });

  for (const { id } of VARIANTS) {
    it(`variant ${id}: unique, logically solvable and consistent`, () => {
      for (let seed = 1; seed <= 10; seed++) {
        const p = generate(id, seed);
        const n = Number(id);
        expect(p.size).toBe(n);
        expect(p.regions).toHaveLength(n * n);
        expect(p.solution).toHaveLength(n * n);
        const regionCount = Math.max(...p.regions) + 1;
        expect(p.solution.filter(Boolean)).toHaveLength(regionCount * 2);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, shaded: p.solution });
      }
    }, 240_000);
  }
});

describe('validate', () => {
  // Four 2×2 blocks.
  const p = puzzle(['aabb', 'aabb', 'ccdd', 'ccdd']);
  const GOOD = [0, 1, 3, 7, 8, 12, 14, 15];

  it('accepts one domino per region', () => {
    expect(validate(p, shade(4, GOOD))).toBe(true);
  });

  it('rejects a region with the wrong number of shaded cells', () => {
    expect(validate(p, shade(4, [...GOOD, 5]))).toBe(false);
    expect(validate(p, shade(4, GOOD.slice(2)))).toBe(false);
  });

  it('rejects shaded cells that are not in exactly one domino', () => {
    // (0,0) and (1,1) are shaded but only touch each other diagonally.
    expect(validate(p, shade(4, [0, 5, 3, 7, 8, 12, 14, 15]))).toBe(false);
    // Two dominoes touching side by side form a tetromino.
    expect(validate(p, shade(4, [0, 1, 2, 3, 8, 12, 14, 15]))).toBe(false);
  });

  it('rejects a wrong-sized grid', () => {
    expect(validate(p, shade(3, []))).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('a region of two cells is fully shaded and its neighbours are not', () => {
    const p = puzzle(['aabb', 'bbbb', 'bbbb', 'bbbb']);
    const { shaded, solved } = solveLogic(p);
    expect(solved).toBe(false);
    expect(shaded.slice(0, 2)).toEqual([true, true]);
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    const p = puzzle(['aabb', 'aabb', 'ccdd', 'ccdd']);
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(puzzle(['ab', 'bb']))).toBe(0);
    expect(countSolutions(puzzle(['aa', 'bb']))).toBe(0);
  });
});
