import { buildEdgeBoard } from '../../core/edgeboard';
import { t } from '../../core/i18n';
import { gridPeers, mountPad, newPadState, padMistakes, padProgress, padSolved, padValidSave, type PadState } from '../../core/numpad';
import type { GameModule } from '../../core/types';
import { DEFAULT_VARIANT, VARIANTS, visible, type SkyscrapersPuzzle } from './logic';

export const skyscrapers: GameModule<SkyscrapersPuzzle, PadState> = {
  id: 'skyscrapers',
  title: 'Skyscrapers',
  blurb: 'Fill a Latin square of building heights; clues count what you can see.',
  icon: `<svg viewBox="0 0 30 30" fill="currentColor"><rect x="3" y="14" width="6" height="14" rx="1"/><rect x="11" y="6" width="6" height="22" rx="1"/><rect x="19" y="10" width="6" height="18" rx="1"/><path d="M2 29h26" stroke="currentColor" stroke-width="2"/><g style="fill:var(--surface)" font-family="system-ui,sans-serif" font-weight="700" font-size="5.5" text-anchor="middle"><text x="6" y="22">2</text><text x="14" y="22">4</text><text x="22" y="22">3</text></g></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => newPadState(new Array(p.size * p.size).fill(0)),
  isSolved: (p, s) => padSolved(p.solution, s),
  mistakes: (p, s) => padMistakes(new Array(p.size * p.size).fill(0), p.solution, s),
  hasProgress: (p, s) => padProgress(new Array(p.size * p.size).fill(0), s),
  isValidSave: (p, s) => padValidSave(p.size * p.size, s),

  mount(ctx) {
    const p = ctx.puzzle;
    const n = p.size;
    const { board } = ctx;
    board.classList.add('num-board', 'skyscrapers');
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Skyscrapers board'));
    const eb = buildEdgeBoard(board, n, n, { top: true, bottom: true, left: true, right: true });
    const texts: [HTMLElement[], number[]][] = [[eb.top, p.top], [eb.bottom, p.bottom], [eb.left, p.left], [eb.right, p.right]];
    for (const [els, clues] of texts) els.forEach((c, k) => (c.textContent = clues[k] ? String(clues[k]) : ''));
    ctx.fit(eb.cols, eb.rows);

    /** Marks each clue as satisfied or broken once its whole line is filled in. */
    const markClues = () => {
      const v = ctx.state.values;
      const check = (clue: HTMLElement, want: number, cells: number[]) => {
        const line = cells.map((i) => v[i]);
        const full = want > 0 && line.every(Boolean);
        const ok = full && visible(line) === want;
        clue.classList.toggle('done', ok);
        clue.classList.toggle('bad', full && !ok);
      };
      for (let k = 0; k < n; k++) {
        const col = Array.from({ length: n }, (_, r) => r * n + k);
        const row = Array.from({ length: n }, (_, c) => k * n + c);
        check(eb.top[k], p.top[k], col);
        check(eb.bottom[k], p.bottom[k], col.slice().reverse());
        check(eb.left[k], p.left[k], row);
        check(eb.right[k], p.right[k], row.slice().reverse());
      }
    };

    return mountPad({
      ctx,
      cells: eb.cells,
      max: n,
      locked: () => false,
      peers: gridPeers(n),
      digitTotal: n,
      onChange: markClues,
    });
  },
};
