import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, generate, type KuromasuPuzzle, solveLogic, validate, VARIANTS } from './logic';

const grid = (n: number, cells: number[]): boolean[] => {
  const g = new Array<boolean>(n * n).fill(false);
  cells.forEach((i) => (g[i] = true));
  return g;
};

const puzzle = (n: number, clues: number[]): KuromasuPuzzle => ({ size: n, clues, solution: [], variant: String(n), seed: 0 });

const FIXTURE: KuromasuPuzzle = {
  size: 5,
  clues: [0, 6, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 6, 0],
  solution: '0010010001001001000100100'.split('').map((x) => x === '1'),
  variant: '5',
  seed: 0,
};

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('7', 42)).toEqual(generate('7', 42));
    expect(generate('7', 42).clues).not.toEqual(generate('7', 43).clues);
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
        expect(p.clues.every((c, i) => c === 0 || (c >= 1 && !p.solution[i]))).toBe(true);
        expect(p.clues.some(Boolean)).toBe(true);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, shaded: p.solution });
      }
    }, 60_000);
  }
});

describe('validate', () => {
  // A single shaded centre: the corner sees itself plus two cells each way.
  it('accepts a correct shading', () => {
    expect(validate(puzzle(3, [5, 3, 0, 0, 0, 0, 0, 0, 0]), grid(3, [4]))).toBe(true);
  });

  it('rejects a wrong visibility count', () => {
    expect(validate(puzzle(3, [4, 0, 0, 0, 0, 0, 0, 0, 0]), grid(3, [4]))).toBe(false);
  });

  it('rejects a shaded numbered cell and touching shaded cells', () => {
    expect(validate(puzzle(3, [0, 0, 0, 0, 1, 0, 0, 0, 0]), grid(3, [4]))).toBe(false);
    expect(validate(puzzle(3, new Array(9).fill(0)), grid(3, [0, 1]))).toBe(false);
  });

  it('rejects white cells that are split apart', () => {
    // Shading (0,1) and (1,0) isolates the corner (0,0).
    expect(validate(puzzle(3, new Array(9).fill(0)), grid(3, [1, 3]))).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('solves a stored puzzle', () => {
    expect(countSolutions(FIXTURE)).toBe(1);
    expect(solveLogic(FIXTURE)).toEqual({ solved: true, shaded: FIXTURE.solution });
  });

  it('a number that sees everything keeps its row and column white', () => {
    const p = puzzle(3, [5, 0, 0, 0, 0, 0, 0, 0, 0]);
    const d = solveLogic(p);
    expect(d.shaded.filter(Boolean)).toHaveLength(0);
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    const p = puzzle(3, [5, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(puzzle(3, [9, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(0);
  });
});
