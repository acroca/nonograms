import { gridPeers, mountPad, newPadState, padMistakes, padProgress, padSolved, padValidSave, type PadState } from '../../core/numpad';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { BOXES, DEFAULT_VARIANT, sizeOf, VARIANTS, type SudokuPuzzle } from './logic';
import { t } from '../../core/i18n';

/** Square N×N board with thick box lines (3×3 boxes by default); returns the cell elements. */
export function sudokuCells(board: HTMLElement, label: string, n = 9): HTMLElement[] {
  const [bh, bw] = BOXES[n];
  board.classList.add('grid-board', 'num-board');
  board.style.setProperty('--n', String(n));
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', label);
  return Array.from({ length: n * n }, (_, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const cell = el('div', 'cell');
    if (c % bw === bw - 1 && c < n - 1) cell.classList.add('wall-r');
    if (r % bh === bh - 1 && r < n - 1) cell.classList.add('wall-b');
    cell.dataset.i = String(i);
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', t('Row {r}, column {c}', { r: r + 1, c: c + 1 }));
    board.append(cell);
    return cell;
  });
}

export const sudoku: GameModule<SudokuPuzzle, PadState> = {
  id: 'sudoku',
  title: 'Sudoku',
  blurb: 'The classic: every row, column and box holds each digit once. 4×4, 6×6 or 9×9.',
  icon: `<svg viewBox="0 0 30 30" fill="none" stroke="currentColor"><rect x="2" y="2" width="26" height="26" rx="2" stroke-width="2"/><path d="M11 2v26M19 2v26M2 11h26M2 19h26" stroke-width="1.2"/><g fill="currentColor" stroke="none" font-family="system-ui,sans-serif" font-weight="700" font-size="7" text-anchor="middle"><text x="6.5" y="9.3">5</text><text x="15" y="17.3">3</text><text x="23.5" y="25.3">9</text><text x="23.5" y="9.3" fill="#2563eb">7</text></g></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => newPadState(p.givens),
  isSolved: (p, s) => padSolved(p.solution, s),
  mistakes: (p, s) => padMistakes(p.givens, p.solution, s),
  hasProgress: (p, s) => padProgress(p.givens, s),
  isValidSave: (p, s) => !!BOXES[sizeOf(p)] && padValidSave(p.givens.length, s),

  mount(ctx) {
    const n = sizeOf(ctx.puzzle);
    const cells = sudokuCells(ctx.board, t('Sudoku board'), n);
    ctx.fit(n, n);
    return mountPad({
      ctx,
      cells,
      max: n,
      locked: (i) => ctx.puzzle.givens[i] !== 0,
      peers: gridPeers(n, ...BOXES[n]),
      digitTotal: n,
    });
  },
};
