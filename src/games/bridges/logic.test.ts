import { describe, expect, it } from 'vitest';
import { countSolutions, crosses, DEFAULT_VARIANT, edgesOf, generate, type BridgesPuzzle, solveLogic, validate, VARIANTS } from './logic';

const make = (size: number, cells: number[], numbers: number[]): BridgesPuzzle => ({
  size,
  cells,
  numbers,
  edges: edgesOf(size, cells),
  solution: [],
  variant: String(size),
  seed: 0,
});

/** Corners of a 3×3 grid, each joined to its two neighbours. */
const ring = (n: number) => make(3, [0, 2, 6, 8], [n, n, n, n]);

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('9', 42)).toEqual(generate('9', 42));
    expect(generate('9', 42).cells).not.toEqual(generate('9', 43).cells);
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
        expect(p.numbers).toHaveLength(p.cells.length);
        expect(p.numbers.every((x) => x >= 1 && x <= 8)).toBe(true);
        expect(p.edges).toEqual(edgesOf(n, p.cells));
        expect(p.solution).toHaveLength(p.edges.length);
        expect(countSolutions(p)).toBe(1);
        expect(validate(p, p.solution)).toBe(true);
        expect(solveLogic(p)).toEqual({ solved: true, bridges: p.solution });
      }
    }, 60_000);
  }
});

describe('edgesOf and crosses', () => {
  it('links facing islands only, never past another island', () => {
    // Row 0: islands at columns 0, 2 and 4; the outer two don't see each other.
    expect(edgesOf(5, [0, 2, 4])).toEqual([[0, 1], [1, 2]]);
  });

  it('detects crossings strictly inside both bridges', () => {
    const p = make(5, [2, 10, 14, 22], [1, 1, 1, 1]);
    expect(p.edges).toEqual([[0, 3], [1, 2]]);
    expect(crosses(5, p.cells, p.edges[0], p.edges[1])).toBe(true);
    expect(crosses(5, p.cells, p.edges[0], p.edges[0])).toBe(false);
  });
});

describe('validate', () => {
  it('accepts a valid joined set of bridges', () => {
    expect(validate(make(5, [0, 2, 4], [1, 2, 1]), [1, 1])).toBe(true);
  });

  it('rejects wrong bridge counts', () => {
    expect(validate(make(5, [0, 2, 4], [1, 2, 1]), [2, 0])).toBe(false);
  });

  it('rejects crossing bridges', () => {
    expect(validate(make(5, [2, 10, 14, 22], [1, 1, 1, 1]), [1, 1])).toBe(false);
  });

  it('rejects separate groups of islands', () => {
    // Every island has two bridges, but they form two separate pairs.
    const p = ring(2);
    expect(p.edges).toEqual([[0, 1], [0, 2], [1, 3], [2, 3]]);
    expect(validate(p, [2, 0, 0, 2])).toBe(false);
    expect(validate(p, [1, 1, 1, 1])).toBe(true);
  });
});

describe('solveLogic and countSolutions', () => {
  it('solves a chain by counting alone', () => {
    const p = make(5, [0, 2, 4], [1, 2, 1]);
    expect(solveLogic(p)).toEqual({ solved: true, bridges: [1, 1] });
  });

  it('rules out closed pairs: only the single ring joins everything', () => {
    // Without the "one group" rule the ring of 2s would have three solutions.
    expect(countSolutions(ring(2))).toBe(1);
  });

  it('counts 2 for an ambiguous puzzle and does not guess it', () => {
    expect(countSolutions(ring(3))).toBe(2);
    expect(solveLogic(ring(3)).solved).toBe(false);
  });

  it('reports 0 for an impossible puzzle', () => {
    expect(countSolutions(make(5, [0, 2, 4], [3, 2, 1]))).toBe(0);
  });

  it('two 1-islands facing each other form a closed pair when others exist', () => {
    // 1 - 1 on the top row with a third island far below: no way to connect all three.
    expect(countSolutions(make(5, [0, 2, 20], [1, 1, 1]))).toBe(0);
  });
});
