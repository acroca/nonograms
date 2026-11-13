import { t } from '../../core/i18n';
import { mountPad, newPadState, padMistakes, padProgress, padSolved, padValidSave, type PadState } from '../../core/numpad';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { DEFAULT_VARIANT, VARIANTS, type FillominoPuzzle } from './logic';

export const fillomino: GameModule<FillominoPuzzle, PadState> = {
  id: 'fillomino',
  title: 'Fillomino',
  blurb: 'Fill every cell so each group of equal numbers is that big.',
  icon: `<svg viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 2v13H2M13 15h10v13M23 2v13" fill="none" stroke="currentColor" stroke-width="1.6"/><g fill="currentColor" font-family="system-ui,sans-serif" font-weight="700" font-size="8" text-anchor="middle"><text x="7.500" y="11">2</text><text x="7.500" y="24">1</text><text x="18" y="11">2</text><text x="18" y="24">3</text><text x="25.500" y="11">1</text><text x="25.500" y="24">3</text></g></svg>`,
  variants: VARIANTS.map(({ id, label }) => ({ id, label })),
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => newPadState(p.givens),
  isSolved: (p, s) => padSolved(p.solution, s),
  mistakes: (p, s) => padMistakes(p.givens, p.solution, s),
  hasProgress: (p, s) => padProgress(p.givens, s),
  isValidSave: (p, s) => padValidSave(p.size * p.size, s),

  mount(ctx) {
    const p = ctx.puzzle;
    const n = p.size;
    const { board } = ctx;
    board.classList.add('num-board', 'grid-board');
    board.style.setProperty('--n', String(n));
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Fillomino board'));
    const cells = Array.from({ length: n * n }, (_, i) => {
      const cell = el('div', 'cell');
      cell.dataset.i = String(i);
      cell.setAttribute('role', 'gridcell');
      board.append(cell);
      return cell;
    });
    ctx.fit(n, n);

    /** Joins equal neighbours visually and flags groups that are too big or complete. */
    const mark = () => {
      const v = ctx.state.values;
      const seen = new Set<number>();
      cells.forEach((cell, i) => {
        cell.classList.toggle('jr', i % n < n - 1 && !!v[i] && v[i] === v[i + 1]);
        cell.classList.toggle('jb', i + n < n * n && !!v[i] && v[i] === v[i + n]);
        cell.classList.remove('done');
      });
      for (let s = 0; s < n * n; s++) {
        if (!v[s] || seen.has(s)) continue;
        const group = [s];
        seen.add(s);
        for (let q = 0; q < group.length; q++) {
          const [r, c] = [Math.floor(group[q] / n), group[q] % n];
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const [rr, cc] = [r + dr, c + dc];
            const j = rr * n + cc;
            if (rr >= 0 && rr < n && cc >= 0 && cc < n && !seen.has(j) && v[j] === v[s]) {
              seen.add(j);
              group.push(j);
            }
          }
        }
        for (const i of group) {
          if (group.length > v[s]) cells[i].classList.add('clash');
          else if (group.length === v[s]) cells[i].classList.add('done');
        }
      }
    };

    return mountPad({
      ctx,
      cells,
      max: p.maxValue,
      locked: (i) => p.givens[i] !== 0,
      peers: () => [],
      onChange: mark,
    });
  },
};
