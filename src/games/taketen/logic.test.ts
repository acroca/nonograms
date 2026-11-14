import { describe, expect, it } from 'vitest';
import {
  addNumbers,
  canPair,
  clearPair,
  COLS,
  DEFAULT_VARIANT,
  findPair,
  generate,
  linked,
  remaining,
  replay,
  VARIANTS,
  type Sheet,
} from './logic';

/** A sheet from rows of digits; `x` followed by a digit is a crossed-out number. */
const sheet = (...rows: string[]): Sheet =>
  rows.flatMap((row) => row.trim().split(/\s+/).map((tok) => (tok[0] === 'x' ? -Number(tok.slice(1)) : Number(tok))));

/** Position of row `r`, column `c`. */
const at = (r: number, c: number) => r * COLS + c;

describe('generate', () => {
  it('is deterministic for a seed', () => {
    expect(generate('6', 42)).toEqual(generate('6', 42));
    expect(generate('6', 42).cells).not.toEqual(generate('6', 43).cells);
  });

  it('falls back to the default variant', () => {
    expect(generate('nope', 1).variant).toBe(DEFAULT_VARIANT);
  });

  for (const { id } of VARIANTS) {
    it(`variant ${id}: every sheet can be cleared without adding numbers`, () => {
      for (let seed = 1; seed <= 100; seed++) {
        const p = generate(id, seed);
        expect(p.rows).toBe(Number(id));
        expect(p.cells).toHaveLength(p.rows * COLS);
        expect(p.cells.every((v) => Number.isInteger(v) && v >= 1 && v <= 9)).toBe(true);
        expect(p.solution).toHaveLength(p.cells.length / 2);
        // Replaying checks each stored move against the rules, on the sheet as it is at that point.
        expect(replay(p.cells, p.solution)).toEqual([]);
        expect(findPair(p.cells)).not.toBeNull();
      }
    });
  }
});

describe('pairs', () => {
  const s = sheet(
    '3 1 8 4 x5 x5 6 2 9',
    '6 7 8 x1 2 x3 5 5 9',
    '1 x2 4 7 x9 3 8 x6 4',
  );

  it('need equal numbers or a sum of 10', () => {
    expect(canPair(s, at(0, 0), at(1, 1))).toBe(true); // 3 + 7, diagonal
    expect(canPair(s, at(0, 2), at(1, 2))).toBe(true); // 8 = 8, column
    expect(canPair(s, at(0, 0), at(0, 1))).toBe(false); // 3 and 1
    expect(linked(s, at(0, 0), at(0, 1))).toBe(true);
  });

  it('work in either order and never with the same square', () => {
    expect(canPair(s, at(1, 1), at(0, 0))).toBe(true);
    expect(canPair(s, at(0, 0), at(0, 0))).toBe(false);
  });

  it('pass over crossed-out numbers along a row, a column and both diagonals', () => {
    const gaps = sheet(
      '4 x1 x1 6 2 9 9 9 7',
      'x5 x3 9 9 9 x8 9 x2 9',
      '4 9 6 9 8 9 3 9 9',
    );
    expect(canPair(gaps, at(0, 0), at(0, 3))).toBe(true); // 4 → 6
    expect(canPair(gaps, at(0, 0), at(2, 0))).toBe(true); // 4 ↓ 4
    expect(canPair(gaps, at(0, 0), at(2, 2))).toBe(true); // 4 ↘ 6
    expect(canPair(gaps, at(0, 8), at(2, 6))).toBe(true); // 7 ↙ 3
    expect(canPair(gaps, at(0, 4), at(2, 4))).toBe(false); // 2 ↓ 8, but a 9 is in the way
    expect(linked(gaps, at(0, 4), at(2, 5))).toBe(false); // not on one line
  });

  it('are blocked by a number in between', () => {
    expect(linked(s, at(0, 0), at(0, 2))).toBe(false);
    expect(linked(s, at(0, 0), at(2, 0))).toBe(false);
    expect(linked(s, at(0, 0), at(2, 2))).toBe(false);
  });

  it('wrap from the end of a row to the start of the next', () => {
    expect(linked(s, at(0, 8), at(1, 0))).toBe(true);
    expect(canPair(s, at(0, 8), at(1, 0))).toBe(false); // 9 and 6
    const wrap = sheet('1 2 3 4 5 6 7 8 4', '6 x2 x3 4 5 6 7 8 9');
    expect(canPair(wrap, at(0, 8), at(1, 0))).toBe(true);
    // Reading order skips crossed-out numbers, also around the end of a row.
    const gap = sheet('1 2 3 4 5 6 7 4 x1', 'x6 x2 6 4 5 6 7 8 9');
    expect(canPair(gap, at(0, 7), at(1, 2))).toBe(true);
    expect(canPair(gap, at(0, 7), at(1, 3))).toBe(false);
  });

  it('do not wrap along a diagonal', () => {
    const d = sheet('1 2 3 4 5 6 7 8 9', '9 1 2 3 4 5 6 7 8');
    // (0, 8) and (1, 0) are neighbours in reading order, but (0, 0) and (1, 8) are not on a diagonal.
    expect(linked(d, at(0, 0), at(1, 8))).toBe(false);
    expect(linked(d, at(0, 8), at(1, 7))).toBe(true);
  });

  it('ignore crossed-out numbers', () => {
    expect(canPair(s, at(0, 4), at(0, 5))).toBe(false);
  });
});

describe('clearPair', () => {
  it('keeps the crossed-out numbers in place', () => {
    expect(clearPair(sheet('3 7 1 4 5 6 7 8 9'), 0, 1)).toEqual(sheet('x3 x7 1 4 5 6 7 8 9'));
  });

  it('drops a row once it is empty, moving the rest up', () => {
    const s = sheet('x1 x2 x3 x4 x5 x6 x7 4 6', '1 2 3 4 5 6 7 8 9', '5 5');
    expect(clearPair(s, 7, 8)).toEqual(sheet('1 2 3 4 5 6 7 8 9', '5 5'));
    expect(clearPair(s, at(2, 0), at(2, 1))).toEqual(s.slice(0, 2 * COLS));
  });

  it('empties the sheet with the last pair', () => {
    expect(clearPair(sheet('x1 x2 3 7'), 2, 3)).toEqual([]);
  });
});

describe('addNumbers', () => {
  it('copies what is left to the end, in reading order', () => {
    const s = sheet('1 x2 3 x4 5 6 7 8 9', '2 x8');
    expect(addNumbers(s)).toEqual([...s, 1, 3, 5, 6, 7, 8, 9, 2]);
    expect(remaining(addNumbers(s))).toBe(2 * remaining(s));
  });
});

describe('findPair', () => {
  it('returns a legal pair, or null when stuck', () => {
    const s = sheet('1 2 3 4 1 2 3 4 1');
    expect(findPair(s)).toBeNull();
    const again = addNumbers(s);
    const found = findPair(again)!;
    expect(canPair(again, ...found)).toBe(true);
  });
});
