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
    // The cell before each one on its thermometer (towards the bulb), or -1 for a bulb.
    const before = new Array<number>(n * n).fill(-1);
    paths.forEach((cells) => {
      cells.forEach((cell, k) => {
        const link = [cells[k - 1], cells[k + 1]].filter((x) => x !== undefined);
        const flag = (j: number) => link.includes(j);
        const [u, d, l, r] = [flag(cell - n), flag(cell + n), flag(cell - 1), flag(cell + 1)];
        const tube = el('span', 'tube');
        const pad = 22;
        tube.style.inset = `${u ? 0 : pad}% ${r ? 0 : pad}% ${d ? 0 : pad}% ${l ? 0 : pad}%`;
        const rad = (a: boolean, b: boolean) => (a || b ? '0' : '45%');
        tube.style.borderRadius = `${rad(u, l)} ${rad(u, r)} ${rad(d, r)} ${rad(d, l)}`;
        eb.cells[cell].append(tube);
        if (k === 0) eb.cells[cell].append(el('span', 'bulb'));
        else before[cell] = cells[k - 1];
      });
    });
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
        cell.classList.toggle('fill', v === FILLED);
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
