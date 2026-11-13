import { t } from '../../core/i18n';
import { cyclePaint } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { DEFAULT_VARIANT, sight, VARIANTS, WHITE, type LightUpPuzzle } from './logic';

const EMPTY = 0;
const BULB = 1;
const DOT = 2;
const NAMES = ['empty', 'bulb', 'no bulb'];

export interface LightUpState {
  /** Per cell: EMPTY, BULB or DOT (marked as no bulb). Walls stay EMPTY. */
  cells: number[];
}

export const lightup: GameModule<LightUpPuzzle, LightUpState> = {
  id: 'lightup',
  title: 'Light Up',
  blurb: 'Place bulbs to light every cell; bulbs must not light each other.',
  icon: `<svg viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="2" width="9" height="9" fill="currentColor"/><rect x="19" y="19" width="9" height="9" fill="currentColor"/><path d="M15 6v18M6 15h18" stroke="currentColor" stroke-width="5" opacity=".28"/><circle cx="15" cy="15" r="5" fill="currentColor"/></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => ({ cells: new Array(p.size * p.size).fill(EMPTY) }),
  isSolved: (p, s) => s.cells.every((v, i) => (v === BULB) === p.solution[i]),
  mistakes: (p, s) =>
    s.cells.flatMap((v, i) => ((v === BULB && !p.solution[i]) || (v === DOT && p.solution[i]) ? [i] : [])),
  hasProgress: (_, s) => s.cells.some((v) => v !== EMPTY),
  isValidSave: (p, s) => Array.isArray(s?.cells) && s.cells.length === p.size * p.size,

  mount(ctx) {
    const { board } = ctx;
    const { size: n, clues } = ctx.puzzle;
    board.classList.add('grid-board');
    board.style.setProperty('--n', String(n));
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Light Up board'));
    const views = clues.map((c, i) => (c === WHITE ? sight(n, clues, i) : []));
    const cells = clues.map((clue, i) => {
      const cell = el('div', clue === WHITE ? 'cell' : 'cell wall');
      cell.dataset.i = String(i);
      cell.setAttribute('role', 'gridcell');
      if (clue >= 0) cell.textContent = String(clue);
      board.append(cell);
      return cell;
    });
    ctx.fit(n, n);
    ctx.toolbar.append(el('p', 'hint', t('Tap: bulb → dot → clear. Drag to paint.')));

    const render = () => {
      const s = ctx.state.cells;
      const lit = new Array<number>(n * n).fill(0);
      s.forEach((v, i) => {
        if (v === BULB) for (const j of views[i]) lit[j]++;
      });
      cells.forEach((cell, i) => {
        const v = s[i];
        cell.classList.remove('wrong');
        if (clues[i] !== WHITE) {
          const around = [i - n, i + n, i % n ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < n * n && clues[j] === WHITE);
          const bulbs = around.filter((j) => s[j] === BULB).length;
          const open = around.filter((j) => s[j] === EMPTY).length;
          const want = clues[i];
          cell.classList.toggle('bad', want >= 0 && (bulbs > want || bulbs + open < want));
          cell.classList.toggle('done', want >= 0 && bulbs === want);
          cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: Math.floor(i / n) + 1, c: (i % n) + 1 })}: ${want >= 0 ? t('wall {n}', { n: want }) : t('wall')}`);
          return;
        }
        cell.classList.toggle('is-bulb', v === BULB);
        cell.classList.toggle('is-dot', v === DOT);
        cell.classList.toggle('lit', lit[i] > 0);
        cell.classList.toggle('clash', v === BULB && lit[i] > 1);
        cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: Math.floor(i / n) + 1, c: (i % n) + 1 })}: ${t(NAMES[v])}${lit[i] ? `, ${t('lit')}` : ''}`);
      });
    };

    const stop = cyclePaint({
      board,
      canEdit: () => !ctx.finished,
      locked: (i) => clues[i] !== WHITE,
      get: (i) => ctx.state.cells[i],
      set: (i, v) => (ctx.state.cells[i] = v),
      next: (v) => (v + 1) % 3,
      checkpoint: ctx.checkpoint,
      changed: render,
      commit: ctx.commit,
    });

    return {
      render,
      showMistakes: (wrong) => wrong.forEach((i) => cells[i].classList.add('wrong')),
      destroy: stop,
    };
  },
};
