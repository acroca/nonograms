import { describe, expect, it } from 'vitest';
import { countSolutions, DEFAULT_VARIANT, type DominosaPuzzle, edgesFor, generate, solveLogic, validate, VARIANTS } from './logic';

const small = (numbers: number[]): DominosaPuzzle => ({ max: 1, rows: 2, cols: 3, numbers, edges: edgesFor(2, 3), solution: [], variant: '1', seed: 0 });

/** A stored double-3 puzzle (4 rows × 5 columns) and its dominoes as cell pairs. */
const FIXTURE_NUMBERS = '03312123103200310221'.split('').map(Number);
const FIXTURE_DOMINOES = ['0-1', '5-6', '10-11', '12-13', '15-16', '17-18', '2-7', '3-8', '4-9', '14-19'];
const fixture = (): DominosaPuzzle => {
  const edges = edgesFor(4, 5);
  return {
    max: 3,
    rows: 4,
    cols: 5,
    numbers: FIXTURE_NUMBERS,
    edges,
    solution: edges.map(([a, b]) => FIXTURE_DOMINOES.includes(`${a}-${b}`)),
    variant: '3',
    seed: 0,
  };
};

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('5', 42)).toEqual(generate('5', 42));
    expect(generate('5', 42).numbers).not.toEqual(generate('5', 43).numbers);
  });

  it('falls back to the default variant', () => {
    expect(generate('nope', 1).variant).toBe(DEFAULT_VARIANT);
  });

  for (const { id } of VARIANTS) {
    it(`variant ${id}: unique, logically solvable and consistent`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const p = generate(id, seed);
        const max = Number(id);
        expect([p.rows, p.cols]).toEqual([max + 1, max + 2]);
        expect(p.numbers).toHaveLength(p.rows * p.cols);
        expect(p.numbers.every((x) => x >= 0 && x <= max)).toBe(true);
        expect(p.solution.filter(Boolean)).toHaveLength((max + 1) * (max + 2) / 2);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, layout: p.solution });
      }
    }, 60_000);
  }
});

describe('validate', () => {
  it('accepts the stored layout', () => {
    expect(validate(fixture(), fixture().solution)).toBe(true);
  });

  it('rejects an uncovered cell or an overlap', () => {
    const p = fixture();
    const missing = p.solution.slice();
    missing[p.edges.findIndex(([a, b]) => a === 0 && b === 1)] = false;
    expect(validate(p, missing)).toBe(false);
    const overlap = p.solution.slice();
    overlap[p.edges.findIndex(([a, b]) => a === 1 && b === 2)] = true;
    expect(validate(p, overlap)).toBe(false);
  });

  it('rejects a layout that uses a number pair twice', () => {
    // Every domino of this layout is a 0-1.
    const p = small([0, 1, 0, 1, 0, 1]);
    const bad = p.edges.map(([a, b]) => ['0-1', '3-4', '2-5'].includes(`${a}-${b}`));
    expect(validate(p, bad)).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('solves a stored puzzle', () => {
    const p = fixture();
    expect(countSolutions(p)).toBe(1);
    expect(solveLogic(p)).toEqual({ solved: true, layout: p.solution });
  });

  it('a pair that fits in only one place is placed', () => {
    const p = small([1, 0, 0, 0, 1, 1]);
    expect(countSolutions(p)).toBe(1);
    expect(solveLogic(p).solved).toBe(true);
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    const p = small([0, 0, 1, 0, 1, 1]);
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(small([0, 1, 0, 1, 0, 1]))).toBe(0);
  });
});
