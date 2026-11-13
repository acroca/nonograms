import { buildEdgeBoard } from '../../core/edgeboard';
import { t } from '../../core/i18n';
import { cyclePaint } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { DEFAULT_VARIANT, VARIANTS, type TentsPuzzle } from './logic';

const EMPTY = 0;
const TENT = 1;
const GRASS = 2;
const NAMES = ['empty', 'tent', 'grass'];

export interface TentsState {
  /** Per cell: EMPTY, TENT or GRASS (marked as no tent). Trees stay EMPTY. */
  cells: number[];
}

const TREE_SVG = `<svg class="tree" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l6 8h-3l5 7H4l5-7H6z" fill="currentColor"/><rect x="10.5" y="17" width="3" height="5" fill="#92400e"/></svg>`;
const TENT_SVG = `<svg class="tent" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L2.5 20h19z" fill="currentColor"/><path d="M12 10l-3.2 10h6.4z" style="fill:var(--surface)"/></svg>`;

/** Tents that touch another tent, even diagonally. */
function touching(n: number, cells: number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== TENT) continue;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < n && cc >= 0 && cc < n && cells[rr * n + cc] === TENT) out.add(i).add(rr * n + cc);
    }
  }
  return out;
}

export const tents: GameModule<TentsPuzzle, TentsState> = {
  id: 'tents',
  title: 'Tents',
  blurb: 'Pitch one tent beside every tree; tents never touch.',
  icon: `<svg viewBox="0 0 30 30"><path d="M8 3l5 7H10.5l4 6H3l4-6H4.5z" fill="currentColor" opacity=".55"/><path d="M20 12l8 15H12z" fill="currentColor"/><path d="M20 19l-2.6 8h5.2z" style="fill:var(--surface)"/></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => ({ cells: new Array(p.size * p.size).fill(EMPTY) }),
  isSolved: (p, s) => s.cells.every((v, i) => (v === TENT) === p.solution[i]),
  mistakes: (p, s) =>
    s.cells.flatMap((v, i) => ((v === TENT && !p.solution[i]) || (v === GRASS && p.solution[i]) ? [i] : [])),
  hasProgress: (_, s) => s.cells.some((v) => v !== EMPTY),
  isValidSave: (p, s) => Array.isArray(s?.cells) && s.cells.length === p.size * p.size,

  mount(ctx) {
    const { board } = ctx;
    const { size: n, trees, rowCounts, colCounts } = ctx.puzzle;
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Tents board'));
    const eb = buildEdgeBoard(board, n, n, { top: true, left: true });
    eb.cells.forEach((cell, i) => {
      if (trees[i]) {
        cell.classList.add('tree-cell');
        cell.innerHTML = TREE_SVG;
      } else {
        cell.innerHTML = `${TENT_SVG}<span class="grass-dot"></span>`;
      }
    });
    eb.top.forEach((c, k) => (c.textContent = String(colCounts[k])));
    eb.left.forEach((c, k) => (c.textContent = String(rowCounts[k])));
    ctx.fit(eb.cols, eb.rows);
    ctx.toolbar.append(el('p', 'hint', t('Tap: tent → grass → clear. Drag to paint.')));

    const render = () => {
      const s = ctx.state.cells;
      const clash = touching(n, s);
      const rows = new Array(n).fill(0);
      const cols = new Array(n).fill(0);
      s.forEach((v, i) => {
        if (v === TENT) {
          rows[Math.floor(i / n)]++;
          cols[i % n]++;
        }
      });
      eb.cells.forEach((cell, i) => {
        const v = s[i];
        cell.classList.toggle('is-tent', v === TENT);
        cell.classList.toggle('is-grass', v === GRASS);
        cell.classList.toggle('clash', clash.has(i));
        cell.classList.remove('wrong');
        const what = trees[i] ? t('tree') : t(NAMES[v]);
        cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: Math.floor(i / n) + 1, c: (i % n) + 1 })}: ${what}`);
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
      locked: (i) => trees[i],
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
