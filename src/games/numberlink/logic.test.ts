import { describe, expect, it } from 'vitest';
import { edgeCells, edgeCount } from '../masyu/logic';
import { coloursOf, countSolutions, DEFAULT_VARIANT, generate, type NumberlinkPuzzle, solveLogic, validate, VARIANTS } from './logic';

/** Links drawn along the given cell paths. */
const linksFrom = (n: number, paths: number[][]): boolean[] => {
  const links = new Array<boolean>(edgeCount(n)).fill(false);
  for (const path of paths) {
    for (let k = 1; k < path.length; k++) {
      const e = links.findIndex((_, i) => edgeCells(n, i).slice().sort().join() === [path[k - 1], path[k]].sort().join());
      links[e] = true;
    }
  }
  return links;
};

const puzzle = (n: number, ends: Record<number, number>): NumberlinkPuzzle => ({
  size: n,
  pairs: Math.max(...Object.values(ends)),
  ends: Array.from({ length: n * n }, (_, i) => ends[i] ?? 0),
  solution: [],
  links: [],
  variant: String(n),
  seed: 0,
});

// 3×3: pair 2 takes the bottom row, so pair 1 must loop round through the other six cells.
const P3 = puzzle(3, { 0: 1, 1: 1, 6: 2, 8: 2 });
const PATHS_3 = [[0, 3, 4, 5, 2, 1], [6, 7, 8]];

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('6', 42)).toEqual(generate('6', 42));
    expect(generate('6', 42).ends).not.toEqual(generate('6', 43).ends);
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
        expect(p.solution).toHaveLength(n * n);
        expect(p.solution.every((c) => c >= 1 && c <= p.pairs)).toBe(true);
        for (let k = 1; k <= p.pairs; k++) expect(p.ends.filter((x) => x === k)).toHaveLength(2);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.links)).toBe(true);
        expect(coloursOf(p, p.links)).toEqual(p.solution);
        expect(solveLogic(p)).toEqual({ solved: true, links: p.links });
      }
    }, 120_000);
  }
});

describe('validate', () => {
  it('accepts paths that connect every pair and cover the grid', () => {
    expect(validate(P3, linksFrom(3, PATHS_3))).toBe(true);
    expect(coloursOf(P3, linksFrom(3, PATHS_3))).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('rejects uncovered cells', () => {
    expect(validate(P3, linksFrom(3, [[0, 3, 4, 5, 2, 1], [6, 7]]))).toBe(false);
  });

  it('rejects paths that connect the wrong ends', () => {
    expect(validate(P3, linksFrom(3, [[0, 3, 4, 7, 6], [1, 2, 5, 8]]))).toBe(false);
  });

  it('rejects a loop left over beside valid paths', () => {
    // 4×4: pair 1 across the top, and the 2×... lower block forms a closed loop instead of a path.
    const p = puzzle(4, { 0: 1, 3: 1 });
    const links = linksFrom(4, [[0, 1, 2, 3], [4, 5, 9, 8], [6, 7, 11, 10]]);
    expect(validate(p, links)).toBe(false);
  });
});

describe('solveLogic and countSolutions', () => {
  it('counts one solution for the 3×3 and finds it by deduction', () => {
    expect(countSolutions(P3)).toBe(1);
    expect(solveLogic(P3)).toEqual({ solved: true, links: linksFrom(3, PATHS_3) });
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    // One pair on the top corners of a 3×3 board can fill it by going round either way.
    const p = puzzle(3, { 0: 1, 2: 1 });
    expect(countSolutions(p)).toBe(2);
    expect(solveLogic(p, false).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    // Opposite corners of a 2×2 board: the path cannot also cover the other two cells.
    expect(countSolutions(puzzle(2, { 0: 1, 3: 1 }))).toBe(0);
  });
});
