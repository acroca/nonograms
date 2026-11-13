import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, generate, solveLogic, type ThermometersPuzzle, validate, VARIANTS } from './logic';

const make = (thermometers: number[][], rowCounts: number[], colCounts: number[]): ThermometersPuzzle => ({
  size: 3,
  thermometers,
  rowCounts,
  colCounts,
  solution: [],
  variant: '3',
  seed: 0,
});

const grid = (cells: number[]): boolean[] => {
  const g = new Array<boolean>(9).fill(false);
  cells.forEach((i) => (g[i] = true));
  return g;
};

// Three thermometers snaking through a 3×3 board; the stored answer fills cells 0, 3 and 4.
const EASY = make([[4, 5, 8], [0, 3, 6, 7], [2, 1]], [1, 2, 0], [2, 1, 0]);
const NEEDS_LOOKAHEAD = make([[5, 8, 7], [3, 6], [1, 0], [2], [4]], [2, 2, 1], [1, 2, 2]);
const AMBIGUOUS = make([[0, 1, 4, 3], [8, 7], [6], [5, 2]], [2, 2, 1], [2, 2, 1]);

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('6', 42)).toEqual(generate('6', 42));
    expect(generate('6', 42).thermometers).not.toEqual(generate('6', 43).thermometers);
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
        // The thermometers tile the grid exactly.
        expect(p.thermometers.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: n * n }, (_, i) => i));
        expect(p.solution).toHaveLength(n * n);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, filled: p.solution });
      }
    }, 60_000);
  }
});

describe('validate', () => {
  it('accepts a contiguous fill with the right counts', () => {
    expect(validate(EASY, grid([0, 3, 4]))).toBe(true);
  });

  it('rejects a fill that skips a cell of a thermometer', () => {
    // Cell 6 is filled but 3 below the bulb... is not.
    expect(validate(EASY, grid([0, 6, 4]))).toBe(false);
  });

  it('rejects wrong row or column counts', () => {
    expect(validate(EASY, grid([0, 3]))).toBe(false);
    expect(validate(EASY, grid([0, 3, 4, 5]))).toBe(false);
  });

  it('rejects a grid of the wrong size', () => {
    expect(validate(EASY, [true, false])).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('solves a puzzle by counts and the mercury rule', () => {
    expect(countSolutions(EASY)).toBe(1);
    expect(solveLogic(EASY, false)).toEqual({ solved: true, filled: grid([0, 3, 4]) });
  });

  it('needs lookahead for a harder one, which is still unique', () => {
    expect(countSolutions(NEEDS_LOOKAHEAD)).toBe(1);
    expect(solveLogic(NEEDS_LOOKAHEAD, false).solved).toBe(false);
    expect(solveLogic(NEEDS_LOOKAHEAD).solved).toBe(true);
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    expect(countSolutions(AMBIGUOUS)).toBe(2);
    expect(solveLogic(AMBIGUOUS).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(make([[0, 1, 2], [3, 4, 5], [6, 7, 8]], [3, 0, 3], [3, 1, 2]))).toBe(0);
  });
});
