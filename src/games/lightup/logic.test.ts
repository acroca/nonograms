import { describe, expect, it } from 'vitest';
import { BLANK, countSolutions, DEFAULT_VARIANT, generate, type LightUpPuzzle, sight, solveLogic, validate, VARIANTS, WHITE } from './logic';

/** Rows: `.` floor, `*` floor with a bulb (the solution), `#` blank wall, digit = numbered wall. */
const parse = (rows: string[]): LightUpPuzzle => {
  const cells = rows.join('').split('');
  return {
    size: rows.length,
    clues: cells.map((ch) => (ch === '.' || ch === '*' ? WHITE : ch === '#' ? BLANK : Number(ch))),
    solution: cells.map((ch) => ch === '*'),
    variant: String(rows.length),
    seed: 0,
  };
};

const FIXTURE = ['*.0.*.', '#*1.#.', '##.*..', '*#.1.*', '.1*.0.', '.0.*..'];

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
        expect(p.clues.every((c) => c >= WHITE && c <= 4)).toBe(true);
        expect(p.solution).toHaveLength(n * n);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, bulbs: p.solution });
      }
    }, 60_000);
  }
});

describe('sight', () => {
  it('stops at walls and includes the cell itself', () => {
    const p = parse(['..#.', '....', '....', '....']);
    expect(sight(4, p.clues, 0).sort((a, b) => a - b)).toEqual([0, 1, 4, 8, 12]);
    expect(sight(4, p.clues, 3).sort((a, b) => a - b)).toEqual([3, 7, 11, 15]);
  });
});

describe('validate', () => {
  const p = parse(FIXTURE);

  it('accepts the intended solution', () => {
    expect(validate(p, p.solution)).toBe(true);
  });

  it('rejects bulbs that see each other', () => {
    const grid = p.solution.slice();
    grid[1] = true; // (0,1) now sees the bulb at (0,0)
    expect(validate(p, grid)).toBe(false);
  });

  it('rejects unlit cells', () => {
    const grid = p.solution.slice();
    grid[26] = false; // drop the bulb at (4,2): its cells go dark
    expect(validate(p, grid)).toBe(false);
  });

  it('rejects wrong wall counts and bulbs on walls', () => {
    const wall = p.solution.slice();
    wall[2] = true;
    expect(validate(p, wall)).toBe(false);
    expect(validate(p, new Array(36).fill(false))).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('solves a puzzle with numbers by propagation alone', () => {
    const p = parse(FIXTURE);
    expect(countSolutions(p)).toBe(1);
    expect(solveLogic(p)).toEqual({ solved: true, bulbs: p.solution });
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    // Two bulbs on either diagonal of an empty 2×2 light everything.
    const p = parse(['..', '..']);
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(parse(['4.', '..']))).toBe(0);
  });

  it('a 0 wall keeps its neighbours dark of bulbs, and a lone cell needs its own bulb', () => {
    const p = parse(['0#', '..']);
    const { bulbs } = solveLogic(p);
    expect(bulbs[2]).toBe(false);
    expect(countSolutions(parse(['#.#', '###']))).toBe(1);
  });
});
