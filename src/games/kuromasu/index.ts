import { t } from '../../core/i18n';
import { cyclePaint } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { DEFAULT_VARIANT, VARIANTS, type KuromasuPuzzle } from './logic';

const EMPTY = 0;
const SHADED = 1;
const DOT = 2;
const NAMES = ['empty', 'shaded', 'unshaded'];

export interface KuromasuState {
  /** Per cell: EMPTY, SHADED or DOT (marked as unshaded). Numbered cells stay EMPTY. */
  cells: number[];
}

/** How many cells a number sees: `loose` counts unmarked cells as visible, otherwise only cells marked unshaded. */
function reach(n: number, cells: number[], clues: number[], i: number, loose: boolean): number {
  let count = 1;
  const [r, c] = [Math.floor(i / n), i % n];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n; rr += dr, cc += dc) {
      const j = rr * n + cc;
      const v = cells[j];
      if (v === SHADED || (!loose && v === EMPTY && !clues[j])) break;
      count++;
    }
  }
  return count;
}

export const kuromasu: GameModule<KuromasuPuzzle, KuromasuState> = {
  id: 'kuromasu',
  title: 'Kuromasu',
  blurb: 'Shade cells so every number sees exactly that many cells.',
  icon: `<svg viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="12" y="2" width="8" height="8" fill="currentColor"/><rect x="2" y="20" width="8" height="8" fill="currentColor"/><g fill="currentColor" font-family="system-ui,sans-serif" font-weight="700" font-size="8" text-anchor="middle"><text x="7" y="16">4</text><text x="24" y="21">3</text><text x="16" y="25">5</text></g></svg>`,
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
    board.setAttribute('aria-label', t('Kuromasu board'));
    const cells = clues.map((clue, i) => {
      const cell = el('div', clue ? 'cell clue' : 'cell');
      cell.dataset.i = String(i);
      cell.setAttribute('role', 'gridcell');
      if (clue) cell.textContent = String(clue);
      board.append(cell);
      return cell;
    });
    ctx.fit(n, n);
    ctx.toolbar.append(el('p', 'hint', t('Tap: shade → dot → clear. Drag to paint.')));

    const render = () => {
      const s = ctx.state.cells;
      cells.forEach((cell, i) => {
        const v = s[i];
        const r = Math.floor(i / n);
        const c = i % n;
        const touching = v === SHADED && ((c < n - 1 && s[i + 1] === SHADED) || (c > 0 && s[i - 1] === SHADED) || (r < n - 1 && s[i + n] === SHADED) || (r > 0 && s[i - n] === SHADED));
        cell.classList.toggle('shaded', v === SHADED);
        cell.classList.toggle('dot', v === DOT);
        cell.classList.toggle('clash', touching);
        cell.classList.remove('wrong');
        if (clues[i]) {
          const hi = reach(n, s, clues, i, true);
          const lo = reach(n, s, clues, i, false);
          cell.classList.toggle('bad', hi < clues[i] || lo > clues[i]);
          cell.classList.toggle('done', hi === clues[i] && lo === clues[i]);
        }
        const what = clues[i] ? t('number {n}', { n: clues[i] }) : t(NAMES[v]);
        cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: r + 1, c: c + 1 })}: ${what}`);
      });
    };

    const stop = cyclePaint({
      board,
      canEdit: () => !ctx.finished,
      locked: (i) => clues[i] > 0,
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
