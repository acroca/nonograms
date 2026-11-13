import { t } from '../../core/i18n';
import { trackStrokes } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { DEFAULT_VARIANT, VARIANTS, type DominosaPuzzle } from './logic';

export interface DominosaState {
  /** Per possible domino (see `puzzle.edges`): 1 = placed. */
  edges: number[];
}

export const dominosa: GameModule<DominosaPuzzle, DominosaState> = {
  id: 'dominosa',
  title: 'Dominosa',
  blurb: 'Cut the grid into dominoes so every number pair appears once.',
  icon: `<svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="26" height="11" rx="3"/><path d="M15 3v11"/><rect x="2" y="17" width="11" height="11" rx="3"/><path d="M2 22.500h11"/><g fill="currentColor" stroke="none"><circle cx="8" cy="8.500" r="1.600"/><circle cx="21" cy="6.500" r="1.600"/><circle cx="24" cy="10.500" r="1.600"/><circle cx="18" cy="10.500" r="1.600"/></g></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => ({ edges: new Array(p.edges.length).fill(0) }),
  isSolved: (p, s) => p.solution.every((on, e) => (s.edges[e] === 1) === on),
  mistakes: (p, s) => s.edges.flatMap((v, e) => (v === 1 && !p.solution[e] ? [e] : [])),
  hasProgress: (_, s) => s.edges.some((v) => v === 1),
  isValidSave: (p, s) => Array.isArray(s?.edges) && s.edges.length === p.edges.length,

  mount(ctx) {
    const { board } = ctx;
    const { max, rows, cols, numbers, edges } = ctx.puzzle;
    board.classList.add('grid-board');
    board.style.setProperty('--n', String(cols));
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Dominosa board'));
    const cells = numbers.map((num, i) => {
      const cell = el('div', 'cell');
      cell.dataset.i = String(i);
      cell.setAttribute('role', 'gridcell');
      cell.append(el('span', 'num', String(num)));
      board.append(cell);
      return cell;
    });
    const edgeAt = new Map(edges.flatMap(([a, b], e) => [[`${a}:${b}`, e], [`${b}:${a}`, e]] as [string, number][]));
    const hue = (a: number, b: number) => ((Math.min(a, b) * (max + 1) + Math.max(a, b)) * 137) % 360;

    // The full set, so used dominoes can be ticked off.
    const chart = el('div', 'domino-chart');
    chart.setAttribute('role', 'group');
    chart.setAttribute('aria-label', t('Domino set'));
    const tiles = new Map<number, HTMLElement>();
    for (let a = 0; a <= max; a++) {
      for (let b = a; b <= max; b++) {
        const tile = el('span', 'tile', `${a}${b}`);
        tile.style.setProperty('--h', String(hue(a, b)));
        tiles.set(a * (max + 1) + b, tile);
        chart.append(tile);
      }
    }
    ctx.fit(cols, rows);
    ctx.toolbar.append(chart, el('p', 'hint', t('Drag from one cell to its neighbour to place a domino; tap a domino to remove it.')));

    const render = () => {
      const s = ctx.state.edges;
      const owner = new Array<number>(numbers.length).fill(-1);
      const used = new Map<number, number>();
      s.forEach((v, e) => {
        if (v !== 1) return;
        const [a, b] = edges[e];
        owner[a] = owner[b] = e;
        const key = Math.min(numbers[a], numbers[b]) * (max + 1) + Math.max(numbers[a], numbers[b]);
        used.set(key, (used.get(key) ?? 0) + 1);
      });
      cells.forEach((cell, i) => {
        const e = owner[i];
        cell.classList.toggle('placed', e >= 0);
        cell.classList.remove('wrong', 'jr', 'jb', 'jl', 'jt');
        if (e >= 0) {
          const [a, b] = edges[e];
          const other = a === i ? b : a;
          cell.style.setProperty('--h', String(hue(numbers[a], numbers[b])));
          cell.classList.add(other === i + 1 ? 'jr' : other === i - 1 ? 'jl' : other === i + cols ? 'jb' : 'jt');
          const key = Math.min(numbers[a], numbers[b]) * (max + 1) + Math.max(numbers[a], numbers[b]);
          cell.classList.toggle('clash', (used.get(key) ?? 0) > 1);
        } else {
          cell.classList.remove('clash');
        }
        cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: Math.floor(i / cols) + 1, c: (i % cols) + 1 })}: ${numbers[i]}`);
      });
      for (const [key, tile] of tiles) {
        tile.classList.toggle('used', (used.get(key) ?? 0) > 0);
        tile.classList.toggle('dup', (used.get(key) ?? 0) > 1);
      }
    };

    // Dragging from a cell onto a neighbour places (or lifts) the domino between them; a tap lifts the domino on that cell.
    let prev = -1;
    let dirty = false;
    const mutate = (fn: (s: number[]) => void) => {
      if (!dirty) ctx.checkpoint();
      dirty = true;
      fn(ctx.state.edges);
      render();
    };
    const dominoOn = (cell: number) => edges.findIndex(([a, b], e) => ctx.state.edges[e] === 1 && (a === cell || b === cell));
    const stop = trackStrokes(board, {
      start(cell) {
        if (ctx.finished) return false;
        prev = cell;
        dirty = false;
        return true;
      },
      enter(cell) {
        const e = edgeAt.get(`${prev}:${cell}`);
        if (e !== undefined) {
          mutate((s) => {
            if (s[e] === 1) {
              s[e] = 0;
            } else {
              for (const c of edges[e]) {
                const other = dominoOn(c);
                if (other >= 0) s[other] = 0;
              }
              s[e] = 1;
            }
          });
        }
        prev = cell;
      },
      end(moved) {
        if (!moved) {
          const e = dominoOn(prev);
          if (e >= 0) mutate((s) => (s[e] = 0));
        }
        if (dirty) ctx.commit();
      },
    });

    return {
      render,
      showMistakes: (wrong) =>
        wrong.forEach((e) => edges[e].forEach((c) => cells[c].classList.add('wrong'))),
      destroy: stop,
    };
  },
};
