import { t } from '../../core/i18n';
import { cyclePaint } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { block, DEFAULT_VARIANT, VARIANTS, type MosaicPuzzle } from './logic';

const EMPTY = 0;
const SHADED = 1;
const DOT = 2;
const NAMES = ['empty', 'shaded', 'unshaded'];

export interface MosaicState {
  /** Per cell: EMPTY, SHADED or DOT (marked as unshaded). */
  cells: number[];
}

export const mosaic: GameModule<MosaicPuzzle, MosaicState> = {
  id: 'mosaic',
  title: 'Mosaic',
  blurb: 'Shade cells so each number counts the shaded cells around it.',
  icon: `<svg viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><g fill="currentColor"><rect x="2" y="2" width="9" height="9"/><rect x="20" y="2" width="8" height="9"/><rect x="11" y="11" width="9" height="9"/><rect x="2" y="20" width="9" height="8"/><rect x="20" y="20" width="8" height="8"/></g><g style="fill:var(--surface)" font-family="system-ui,sans-serif" font-weight="700" font-size="8" text-anchor="middle"><text x="15.500" y="18">5</text></g></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => ({ cells: new Array(p.size * p.size).fill(EMPTY) }),
  isSolved: (p, s) => s.cells.every((v, i) => (v === SHADED) === p.solution[i]),
  mistakes: (p, s) =>
    s.cells.flatMap((v, i) => ((v === SHADED && !p.solution[i]) || (v === DOT && p.solution[i]) ? [i] : [])),
  hasProgress: (_, s) => s.cells.some((v) => v !== EMPTY),
  isValidSave: (p, s) => Array.isArray(s?.cells) && s.cells.length === p.size * p.size,

  mount(ctx) {
    const { board } = ctx;
    const { size: n, clues } = ctx.puzzle;
    board.classList.add('grid-board');
    board.style.setProperty('--n', String(n));
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Mosaic board'));
    const blocks = clues.map((_, i) => block(n, i));
    const cells = clues.map((clue, i) => {
      const cell = el('div', 'cell');
      cell.dataset.i = String(i);
      cell.setAttribute('role', 'gridcell');
      if (clue >= 0) cell.append(el('span', 'num', String(clue)));
      board.append(cell);
      return cell;
    });
    ctx.fit(n, n);
    ctx.toolbar.append(el('p', 'hint', t('Tap: shade → dot → clear. Drag to paint.')));

    const render = () => {
      const s = ctx.state.cells;
      cells.forEach((cell, i) => {
        const v = s[i];
        cell.classList.toggle('shaded', v === SHADED);
        cell.classList.toggle('dot', v === DOT);
        cell.classList.remove('wrong');
        if (clues[i] >= 0) {
          const cells3 = blocks[i];
          const shaded = cells3.filter((j) => s[j] === SHADED).length;
          const open = cells3.filter((j) => s[j] === EMPTY).length;
          cell.classList.toggle('bad', shaded > clues[i] || shaded + open < clues[i]);
          cell.classList.toggle('done', open === 0 && shaded === clues[i]);
        }
        const what = `${t(NAMES[v])}${clues[i] >= 0 ? `, ${t('number {n}', { n: clues[i] })}` : ''}`;
        cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: Math.floor(i / n) + 1, c: (i % n) + 1 })}: ${what}`);
      });
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
      showMistakes: (wrong) => wrong.forEach((i) => cells[i].classList.add('wrong')),
      destroy: stop,
    };
  },
};
