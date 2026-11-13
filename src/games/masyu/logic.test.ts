import { describe, expect, it } from 'vitest';
import { BLACK, countSolutions, DEFAULT_VARIANT, edgeCount, generate, hEdge, type MasyuPuzzle, NONE, solveLogic, validate, vEdge, VARIANTS, WHITE } from './logic';

const edges = (n: number, on: number[]): boolean[] => {
  const out = new Array<boolean>(edgeCount(n)).fill(false);
  on.forEach((e) => (out[e] = true));
  return out;
};

const puzzle = (n: number, pearls: Record<number, number>): MasyuPuzzle => ({
  size: n,
  pearls: Array.from({ length: n * n }, (_, i) => pearls[i] ?? NONE),
  solution: [],
  variant: String(n),
  seed: 0,
});

/** The outer ring of a 3×3 board. */
const RING = edges(3, [hEdge(3, 0, 0), hEdge(3, 0, 1), hEdge(3, 2, 0), hEdge(3, 2, 1), vEdge(3, 0, 0), vEdge(3, 1, 0), vEdge(3, 0, 2), vEdge(3, 1, 2)]);

const FIXTURE: MasyuPuzzle = {
  size: 6,
  pearls: '002000000000000020100110100000001000'.split('').map(Number),
  solution: '110011000010110001110010011100101011011011100001101000100100'.split('').map((x) => x === '1'),
  variant: '6',
  seed: 0,
};

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('7', 42)).toEqual(generate('7', 42));
    expect(generate('7', 42).pearls).not.toEqual(generate('7', 43).pearls);
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
        expect(p.pearls).toHaveLength(n * n);
        expect(p.solution).toHaveLength(edgeCount(n));
        expect(p.pearls.filter(Boolean).length).toBeGreaterThanOrEqual(3);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, loop: p.solution });
      }
    }, 120_000);
  }
});

describe('validate', () => {
  it('accepts a single loop and the pearls it satisfies', () => {
    expect(validate(puzzle(3, {}), RING)).toBe(true);
    expect(validate(puzzle(3, { 0: BLACK, 2: BLACK, 6: BLACK, 8: BLACK }), RING)).toBe(true);
    expect(validate(puzzle(3, { 1: WHITE }), RING)).toBe(true);
  });

  it('rejects pearls off the loop or of the wrong kind', () => {
    expect(validate(puzzle(3, { 4: WHITE }), RING)).toBe(false);
    expect(validate(puzzle(3, { 1: BLACK }), RING)).toBe(false);
    expect(validate(puzzle(3, { 0: WHITE }), RING)).toBe(false);
  });

  it('rejects a black pearl whose neighbours do not continue straight', () => {
    // A small 2×2 square: its corners are turns, but the loop turns again right after.
    const square = edges(3, [hEdge(3, 0, 0), hEdge(3, 1, 0), vEdge(3, 0, 0), vEdge(3, 0, 1)]);
    expect(validate(puzzle(3, {}), square)).toBe(true);
    expect(validate(puzzle(3, { 0: BLACK }), square)).toBe(false);
  });

  it('rejects a white pearl when the loop goes straight on both sides', () => {
    // A 2×4 rectangle: the white pearl in the middle of a long side has turns at neither neighbour.
    const rect = edges(4, [hEdge(4, 0, 0), hEdge(4, 0, 1), hEdge(4, 0, 2), hEdge(4, 1, 0), hEdge(4, 1, 1), hEdge(4, 1, 2), vEdge(4, 0, 0), vEdge(4, 0, 3)]);
    expect(validate(puzzle(4, {}), rect)).toBe(true);
    expect(validate(puzzle(4, { 1: WHITE }), rect)).toBe(true);
    const long = edges(5, [hEdge(5, 0, 0), hEdge(5, 0, 1), hEdge(5, 0, 2), hEdge(5, 0, 3), hEdge(5, 1, 0), hEdge(5, 1, 1), hEdge(5, 1, 2), hEdge(5, 1, 3), vEdge(5, 0, 0), vEdge(5, 0, 4)]);
    expect(validate(puzzle(5, { 2: WHITE }), long)).toBe(false);
  });

  it('rejects two separate loops and an empty board', () => {
    const two = edges(5, [hEdge(5, 0, 0), hEdge(5, 1, 0), vEdge(5, 0, 0), vEdge(5, 0, 1), hEdge(5, 3, 3), hEdge(5, 4, 3), vEdge(5, 3, 3), vEdge(5, 3, 4)]);
    expect(validate(puzzle(5, {}), two)).toBe(false);
    expect(validate(puzzle(3, {}), edges(3, []))).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('four black corners force the outer ring', () => {
    const p = puzzle(3, { 0: BLACK, 2: BLACK, 6: BLACK, 8: BLACK });
    expect(countSolutions(p)).toBe(1);
    expect(solveLogic(p)).toEqual({ solved: true, loop: RING });
  });

  it('solves a stored puzzle', () => {
    expect(countSolutions(FIXTURE)).toBe(1);
    expect(solveLogic(FIXTURE)).toEqual({ solved: true, loop: FIXTURE.solution });
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    const p = puzzle(3, { 1: WHITE });
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(puzzle(3, { 4: BLACK }))).toBe(0);
  });
});
