import { describe, expect, it } from 'vitest';
import {
  countSolutions,
  DEFAULT_VARIANT,
  generate,
  MIDDLE,
  RIGHT,
  SINGLE,
  solveLogic,
  UNKNOWN,
  validate,
  VARIANTS,
  WATER,
  type BattleshipsPuzzle,
} from './logic';

/** Builds a puzzle from rows of `#` (ship) and `.`; `givens` maps cell index → revealed piece. */
const make = (rows: string[], fleet: number[], givens: Record<number, number> = {}): BattleshipsPuzzle => {
  const n = rows.length;
  const solution = rows.join('').split('').map((ch) => ch === '#');
  return {
    size: n,
    fleet,
    rowCounts: rows.map((r) => r.split('').filter((ch) => ch === '#').length),
    colCounts: Array.from({ length: n }, (_, c) => rows.filter((r) => r[c] === '#').length),
    givens: Array.from({ length: n * n }, (_, i) => givens[i] ?? UNKNOWN),
    solution,
    variant: String(n),
    seed: 0,
  };
};

const FIXTURE = make(['......', '##.###', '......', '#.....', '..#.##', '#.....'], [3, 2, 1, 0], { 26: SINGLE, 29: RIGHT });

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('8', 42)).toEqual(generate('8', 42));
    expect(generate('8', 42).solution).not.toEqual(generate('8', 43).solution);
  });

  it('falls back to the default variant', () => {
    expect(generate('nope', 1).variant).toBe(DEFAULT_VARIANT);
  });

  for (const { id, size, fleet } of VARIANTS) {
    it(`variant ${id}: unique, logically solvable and consistent`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const p = generate(id, seed);
        expect(p.size).toBe(size);
        expect(p.fleet).toEqual(fleet);
        expect(p.givens).toHaveLength(size * size);
        expect(p.solution.filter(Boolean)).toHaveLength(fleet.reduce((sum, count, k) => sum + count * (k + 1), 0));
        expect(p.givens.some(Boolean)).toBe(true);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, ships: p.solution });
      }
    }, 60_000);
  }
});

describe('validate', () => {
  it('accepts the intended fleet', () => {
    expect(validate(FIXTURE, FIXTURE.solution)).toBe(true);
  });

  it('rejects ships that touch diagonally', () => {
    const p = make(['#.', '.#'], [2, 0]);
    expect(validate(p, p.solution)).toBe(false);
  });

  it('rejects bent ships', () => {
    const p = make(['##', '#.'], [0, 0, 1]);
    expect(validate(p, p.solution)).toBe(false);
  });

  it('rejects a wrong fleet or wrong counts', () => {
    expect(validate({ ...FIXTURE, fleet: [3, 1, 2, 0] }, FIXTURE.solution)).toBe(false);
    expect(validate({ ...FIXTURE, rowCounts: [0, 4, 1, 1, 3, 1] }, FIXTURE.solution)).toBe(false);
  });

  it('rejects grids that contradict a revealed cell', () => {
    expect(validate({ ...FIXTURE, givens: FIXTURE.givens.map((g, i) => (i === 0 ? WATER : g)) }, FIXTURE.solution)).toBe(true);
    expect(validate({ ...FIXTURE, givens: FIXTURE.givens.map((g, i) => (i === 6 ? WATER : g)) }, FIXTURE.solution)).toBe(false);
    expect(validate({ ...FIXTURE, givens: FIXTURE.givens.map((g, i) => (i === 6 ? MIDDLE : g)) }, FIXTURE.solution)).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('solves a puzzle from counts, revealed pieces and the fleet', () => {
    expect(countSolutions(FIXTURE)).toBe(1);
    expect(solveLogic(FIXTURE)).toEqual({ solved: true, ships: FIXTURE.solution });
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    const p = make(['#.#.', '....', '##..', '....'], [2, 1, 0, 0]);
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('a revealed single clears its surroundings', () => {
    const p = { ...make(['....', '.#..', '....', '...#'], [2, 0, 0, 0]), givens: [0, 0, 0, 0, 0, SINGLE, ...new Array(10).fill(0)] };
    const { ships } = solveLogic(p);
    expect(ships.slice(0, 3)).toEqual([false, false, false]);
    expect(ships[5]).toBe(true);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions({ ...FIXTURE, colCounts: [3, 1, 1, 1, 2, 3] })).toBe(0);
  });
});
