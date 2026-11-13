import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDE_IDS, guideFor } from './guides';

const games = readdirSync(new URL('../games', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe('guides', () => {
  it('cover every game', () => {
    expect([...GUIDE_IDS].sort()).toEqual([...games].sort());
  });

  it.each(GUIDE_IDS)('%s has matching English and Spanish text', (id) => {
    const en = guideFor(id, 'en')!;
    const es = guideFor(id, 'es')!;
    for (const key of ['rules', 'controls', 'tips', 'examples'] as const) {
      expect(es[key].length, key).toBe(en[key].length);
      expect(en[key].length, key).toBeGreaterThan(0);
    }
    for (const g of [en, es]) {
      for (const text of [g.goal, ...g.rules, ...g.controls, ...g.tips, ...g.examples.map((e) => e.caption)]) {
        expect(text.trim()).not.toBe('');
      }
    }
  });

  it.each(GUIDE_IDS)('%s has well-formed example drawings', (id) => {
    for (const e of guideFor(id, 'en')!.examples) {
      const rows = e.grid.map((r) => r.trim().split(/\s+/));
      const cols = rows[0].length;
      expect(rows.every((r) => r.length === cols), `ragged grid: ${e.grid.join(' / ')}`).toBe(true);
      if (e.regions) {
        expect(e.regions.map((r) => r.trim().split(/\s+/).length)).toEqual(rows.map(() => cols));
      }
      for (const letter of Object.keys(e.labels ?? {})) {
        expect(e.regions?.join(' ')).toContain(letter);
      }
      for (const [style, spec] of e.lines ?? []) {
        // Corner coordinates may reach the far edge of the grid; centre coordinates stop one short of it.
        const max = style === 'edge' || style === 'cross' ? 0 : 1;
        for (const point of spec.trim().split(/\s+/)) {
          const [x, y] = point.split(',').map(Number);
          expect(x >= 0 && x <= cols - max && y >= 0 && y <= rows.length - max, `${style} ${point}`).toBe(true);
        }
      }
    }
  });
});
