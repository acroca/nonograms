import { t } from '../../core/i18n';
import { trackStrokes } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import {
  addNumbers,
  canPair,
  clearPair,
  COLS,
  DEFAULT_VARIANT,
  findPair,
  isLive,
  remaining,
  VARIANTS,
  type Sheet,
  type TakeTenPuzzle,
} from './logic';

export interface TakeTenState {
  /** The sheet in play; see `Sheet`. */
  cells: Sheet;
  /** Pairs crossed out so far. */
  moves: number;
  /** Times the remaining numbers were added again. */
  adds: number;
}

/** How long (ms) a hint or a refused pair stays marked. */
const FLASH = 900;

export const taketen: GameModule<TakeTenPuzzle, TakeTenState> = {
  id: 'taketen',
  title: 'Take Ten',
  blurb: 'Cross out pairs of numbers that are equal or add up to 10 until none are left.',
  icon: `<svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="10" height="10" rx="2.500"/><rect x="18" y="16" width="10" height="10" rx="2.500"/><path d="M12 14l6 2" stroke-dasharray="1.500 2.500" stroke-linecap="round"/><g fill="currentColor" stroke="none" font-family="system-ui, sans-serif" font-size="8" font-weight="700" text-anchor="middle"><text x="7" y="12">3</text><text x="23" y="24">7</text></g></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  noCheck: true,
  newState: (p) => ({ cells: p.cells.slice(), moves: 0, adds: 0 }),
  isSolved: (_, s) => remaining(s.cells) === 0,
  mistakes: () => [],
  hasProgress: (_, s) => s.moves > 0 || s.adds > 0,
  isValidSave: (p, s) =>
    Array.isArray(p?.cells) &&
    Array.isArray(s?.cells) &&
    s.cells.every((v: unknown) => Number.isInteger(v) && v !== 0 && Math.abs(v as number) <= 9) &&
    Number.isInteger(s.moves) &&
    Number.isInteger(s.adds),

  mount(ctx) {
    const { board } = ctx;
    board.classList.add('grid-board');
    board.style.setProperty('--n', String(COLS));
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Take Ten board'));

    const info = el('p', 'hint taketen-info');
    const addBtn = el('button', 'tool', t('Add numbers'));
    addBtn.type = 'button';
    const hintBtn = el('button', 'tool', t('Hint'));
    hintBtn.type = 'button';
    const bar = el('div', 'tools');
    bar.append(addBtn, hintBtn);
    ctx.toolbar.append(info, bar);

    let selected = -1;
    /** Squares marked for a moment: a hinted pair, or a pair that was refused. */
    let flash: { cells: number[]; cls: string } | null = null;
    let flashTimer = 0;

    const setFlash = (next: typeof flash) => {
      clearTimeout(flashTimer);
      flash = next;
      if (next) {
        flashTimer = window.setTimeout(() => {
          flash = null;
          render();
        }, FLASH);
      }
    };

    const render = () => {
      const sheet = ctx.state.cells;
      if (selected >= sheet.length || !isLive(sheet, selected)) selected = -1;
      const rows = Math.ceil(sheet.length / COLS);
      // Lines come and go, so the squares are rebuilt each time. The last line is padded out with blanks.
      const cells = sheet.map((v, i) => {
        const live = v > 0;
        const cell = el('div', live ? 'cell' : 'cell gone', String(Math.abs(v)));
        cell.dataset.i = String(i);
        cell.setAttribute('role', 'gridcell');
        if (i === selected) cell.classList.add('sel');
        if (flash?.cells.includes(i)) cell.classList.add(flash.cls);
        const where = t('Row {r}, column {c}', { r: Math.floor(i / COLS) + 1, c: (i % COLS) + 1 });
        cell.setAttribute('aria-label', `${where}: ${live ? v : t('crossed out')}`);
        return cell;
      });
      const blanks = Array.from({ length: rows * COLS - sheet.length }, () => el('div', 'cell blank'));
      board.replaceChildren(...cells, ...blanks);
      // Keep the squares the same size while the sheet shrinks; only a sheet that outgrows its start gets smaller ones.
      ctx.fit(COLS, Math.max(rows, ctx.puzzle.rows));

      const left = remaining(sheet);
      const stuck = left > 0 && !findPair(sheet);
      info.textContent = stuck
        ? t('No pairs left. Add the remaining numbers again, or undo.')
        : t('{n} numbers left', { n: left });
      info.classList.toggle('alert', stuck);
      addBtn.classList.toggle('suggest', stuck);
      addBtn.disabled = hintBtn.disabled = ctx.finished || left === 0;
    };

    const pair = (a: number, b: number) => {
      ctx.checkpoint();
      ctx.state.cells = clearPair(ctx.state.cells, a, b);
      ctx.state.moves++;
      selected = -1;
      setFlash(null);
      ctx.commit();
    };

    /** Tries the pair; when it is not allowed, shakes both squares and selects the second. */
    const attempt = (a: number, b: number) => {
      if (canPair(ctx.state.cells, a, b)) return pair(a, b);
      selected = b;
      setFlash({ cells: [a, b], cls: 'nope' });
      render();
    };

    let from = -1;
    let last = -1;
    const stop = trackStrokes(board, {
      start(i) {
        if (ctx.finished || !isLive(ctx.state.cells, i)) return false;
        from = last = i;
        return true;
      },
      enter(i) {
        last = i;
      },
      end(moved) {
        const sheet = ctx.state.cells;
        // A drag from one number to another pairs them directly; a tap selects, then pairs with the next tap.
        if (moved && last !== from) {
          if (isLive(sheet, last)) attempt(from, last);
          return;
        }
        if (selected < 0 || selected === from) {
          selected = selected === from ? -1 : from;
          setFlash(null);
          render();
        } else {
          attempt(selected, from);
        }
      },
    });

    addBtn.addEventListener('click', () => {
      if (ctx.finished) return;
      ctx.checkpoint();
      ctx.state.cells = addNumbers(ctx.state.cells);
      ctx.state.adds++;
      setFlash(null);
      ctx.commit();
    });
    hintBtn.addEventListener('click', () => {
      if (ctx.finished) return;
      const found = findPair(ctx.state.cells);
      selected = -1;
      setFlash(found ? { cells: found, cls: 'hinted' } : null);
      render();
    });

    return {
      render,
      showMistakes: () => {},
      destroy() {
        clearTimeout(flashTimer);
        stop();
      },
    };
  },
};
