import { buildEdgeBoard } from '../../core/edgeboard';
import { t } from '../../core/i18n';
import { cyclePaint } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { DEFAULT_VARIANT, VARIANTS, type ThermometersPuzzle } from './logic';

const EMPTY = 0;
const FILLED = 1;
const MARKED = 2;
const NAMES = ['empty', 'filled', 'marked empty'];

const SVG = 'http://www.w3.org/2000/svg';
/** Sizes in cell units: tube width, bulb radius and glass thickness. */
const TUBE = 0.4;
const BULB = 0.36;
const RIM = 0.06;

export interface ThermometersState {
  /** Per cell: EMPTY, FILLED or MARKED (known to be empty). */
  cells: number[];
}

export const thermometers: GameModule<ThermometersPuzzle, ThermometersState> = {
  id: 'thermometers',
  title: 'Thermometers',
  blurb: 'Fill the thermometers from the bulb to match the row and column counts.',
  icon: `<svg viewBox="0 0 30 30"><rect x="11" y="3" width="8" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2.200"/><circle cx="15" cy="22" r="6" fill="currentColor"/><rect x="13.200" y="10" width="3.600" height="12" rx="1.800" fill="currentColor"/><path d="M22 7h4M22 11h3M22 15h4" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => ({ cells: new Array(p.size * p.size).fill(EMPTY) }),
  isSolved: (p, s) => s.cells.every((v, i) => (v === FILLED) === p.solution[i]),
  mistakes: (p, s) =>
    s.cells.flatMap((v, i) => ((v === FILLED && !p.solution[i]) || (v === MARKED && p.solution[i]) ? [i] : [])),
  hasProgress: (_, s) => s.cells.some((v) => v !== EMPTY),
  isValidSave: (p, s) => Array.isArray(s?.cells) && s.cells.length === p.size * p.size,

  mount(ctx) {
    const { board } = ctx;
    const { size: n, thermometers: paths, rowCounts, colCounts } = ctx.puzzle;
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Thermometers board'));
    const eb = buildEdgeBoard(board, n, n, { top: true, left: true });
    // One drawing over the whole field, in cell units: each thermometer is a glass tube with a bulb at its start,
    // holding one piece of mercury per cell.
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'thermo-art');
    svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
    svg.setAttribute('aria-hidden', 'true');
    const draw = (parent: Element, tag: string, cls: string, attrs: Record<string, string | number>) => {
      const node = document.createElementNS(SVG, tag);
      node.setAttribute('class', cls);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      parent.append(node);
      return node;
    };
    const at = (cell: number): [number, number] => [(cell % n) + 0.5, Math.floor(cell / n) + 0.5];
    const line = (pts: [number, number][]) => `M${pts.map((p) => p.join(' ')).join('L')}`;
    // The cell before each one on its thermometer (towards the bulb), or -1 for a bulb.
    const before = new Array<number>(n * n).fill(-1);
    const mercury = new Array<SVGGElement>(n * n);
    paths.forEach((cells) => {
      const g = draw(svg, 'g', 'thermo', {});
      const [bx, by] = at(cells[0]);
      const d = line(cells.map(at));
      draw(g, 'path', 'glass', { d });
      draw(g, 'circle', 'glass-bulb', { cx: bx, cy: by, r: BULB });
      draw(g, 'path', 'bore', { d });
      draw(g, 'circle', 'bore-bulb', { cx: bx, cy: by, r: BULB - RIM });
      cells.forEach((cell, k) => {
        const [x, y] = at(cell);
        const m = draw(g, 'g', 'mercury', {}) as SVGGElement;
        const pts: [number, number][] = [[x, y]];
        if (k > 0) {
          // Start a little inside the previous cell so neighbouring pieces join without a seam.
          const [px, py] = at(cells[k - 1]);
          pts.unshift([x + (px - x) * 0.51, y + (py - y) * 0.51]);
          before[cell] = cells[k - 1];
        }
        if (k < cells.length - 1) {
          const [nx, ny] = at(cells[k + 1]);
          pts.push([(x + nx) / 2, (y + ny) / 2]);
        }
        if (pts.length > 1) draw(m, 'path', 'level', { d: line(pts) });
        if (k === 0) draw(m, 'circle', 'drop', { cx: x, cy: y, r: BULB - RIM });
        else if (k === cells.length - 1) draw(m, 'circle', 'drop', { cx: x, cy: y, r: TUBE / 2 - RIM });
        mercury[cell] = m;
      });
    });
    eb.field.prepend(svg);
    eb.top.forEach((c, k) => (c.textContent = String(colCounts[k])));
    eb.left.forEach((c, k) => (c.textContent = String(rowCounts[k])));
    ctx.fit(eb.cols, eb.rows);
    ctx.toolbar.append(el('p', 'hint', t('Tap: fill → ✕ → clear. Drag to paint.')));

    const render = () => {
      const s = ctx.state.cells;
      const rows = new Array(n).fill(0);
      const cols = new Array(n).fill(0);
      eb.cells.forEach((cell, i) => {
        const v = s[i];
        if (v === FILLED) {
          rows[Math.floor(i / n)]++;
          cols[i % n]++;
        }
        // Mercury can't float above an empty section.
        mercury[i].classList.toggle('on', v === FILLED);
        cell.classList.toggle('mark', v === MARKED);
        cell.classList.toggle('clash', v === FILLED && before[i] >= 0 && s[before[i]] === MARKED);
        cell.classList.remove('wrong');
        cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: Math.floor(i / n) + 1, c: (i % n) + 1 })}: ${t(NAMES[v])}${before[i] < 0 ? `, ${t('bulb')}` : ''}`);
      });
      const mark = (clue: HTMLElement, have: number, want: number) => {
        clue.classList.toggle('done', have === want);
        clue.classList.toggle('bad', have > want);
      };
      eb.top.forEach((c, k) => mark(c, cols[k], colCounts[k]));
      eb.left.forEach((c, k) => mark(c, rows[k], rowCounts[k]));
    };

    const stop = cyclePaint({
      board,
      canEdit: () => !ctx.finished,
      locked: () => false,
      get: (i) => ctx.state.cells[i],
      set: (i, v) => (ctx.state.cells[i] = v),
      next: (v) => (v + 1) % 3,
      checkpoint: ctx.checkpoint,
      changed: render,
      commit: ctx.commit,
    });

    return {
      render,
      showMistakes: (wrong) => wrong.forEach((i) => eb.cells[i].classList.add('wrong')),
      destroy: stop,
    };
  },
};
