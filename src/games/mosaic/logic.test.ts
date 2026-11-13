import { describe, expect, it } from 'vitest';
import { block, countSolutions, DEFAULT_VARIANT, generate, type MosaicPuzzle, solveLogic, validate, VARIANTS } from './logic';

const puzzle = (n: number, clues: number[]): MosaicPuzzle => ({ size: n, clues, solution: [], variant: String(n), seed: 0 });
const none = (n: number) => new Array<number>(n * n).fill(-1);

describe('block', () => {
  it('covers the cell and its on-board neighbours', () => {
    expect(block(3, 4)).toHaveLength(9);
    expect(block(3, 0).sort()).toEqual([0, 1, 3, 4]);
    expect(block(4, 1).sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 5, 6]);
  });
});

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('8', 42)).toEqual(generate('8', 42));
    expect(generate('8', 42).clues).not.toEqual(generate('8', 43).clues);
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
        expect(p.clues).toHaveLength(n * n);
        expect(p.clues.every((c) => c >= -1 && c <= 9)).toBe(true);
        const given = p.clues.filter((c) => c >= 0).length;
        expect(given).toBeGreaterThan(0);
        expect(given).toBeLessThan(n * n * 0.6);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, shaded: p.solution });
      }
    }, 60_000);
  }
});

describe('validate', () => {
  // The centre block holds 4 shaded cells and the bottom-right corner block holds 2.
  const p = puzzle(3, [-1, -1, -1, -1, 4, -1, -1, -1, 2]);
  const shade = (cells: number[]) => Array.from({ length: 9 }, (_, i) => cells.includes(i));

  it('accepts a grid matching every number', () => {
    expect(validate(p, shade([0, 2, 4, 5]))).toBe(true);
    expect(validate(p, shade([0, 2, 4, 8]))).toBe(true);
  });

  it('rejects a grid where a block has the wrong count', () => {
    expect(validate(p, shade([0, 1, 2, 3]))).toBe(false);
    expect(validate(p, shade([0, 2, 4, 5, 8]))).toBe(false);
  });

  it('rejects a grid of the wrong size', () => {
    expect(validate(p, [true])).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('a 9 shades the whole block and a 0 clears it', () => {
    const nine = puzzle(3, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
    expect(solveLogic(nine, false)).toEqual({ solved: true, shaded: new Array(9).fill(true) });
    const zero = puzzle(3, [-1, -1, -1, -1, 0, -1, -1, -1, -1]);
    expect(solveLogic(zero, false)).toEqual({ solved: true, shaded: new Array(9).fill(false) });
  });

  it('combines overlapping numbers', () => {
    // 2×2 board: the corner numbers 3 and 1 see all four cells, which is impossible; 2 and 2 is ambiguous.
    expect(countSolutions(puzzle(2, [3, 1, -1, -1]))).toBe(0);
    expect(countSolutions(puzzle(2, [2, -1, -1, -1]))).toBe(2);
    expect(solveLogic(puzzle(2, [2, -1, -1, -1])).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(puzzle(2, [5, -1, -1, -1]))).toBe(0);
    expect(countSolutions(puzzle(2, none(2)))).toBeGreaterThanOrEqual(2);
  });
});
