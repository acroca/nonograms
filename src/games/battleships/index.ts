import { buildEdgeBoard } from '../../core/edgeboard';
import { t } from '../../core/i18n';
import { cyclePaint } from '../../core/pointer';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { BOTTOM, DEFAULT_VARIANT, LEFT, MIDDLE, RIGHT, TOP, UNKNOWN, VARIANTS, WATER, type BattleshipsPuzzle } from './logic';

const EMPTY = 0;
const SEA = 1;
const SHIP = 2;
const NAMES = ['empty', 'water', 'ship'];

export interface BattleshipsState {
  /** Per cell: EMPTY, SEA (water) or SHIP. Revealed cells start filled in and stay locked. */
  cells: number[];
}

const initial = (p: BattleshipsPuzzle): number[] => p.givens.map((g) => (g === UNKNOWN ? EMPTY : g === WATER ? SEA : SHIP));

/** Directions a revealed piece implies the ship continues in: [up, down, left, right]. */
const IMPLIED: Record<number, boolean[]> = {
  [TOP]: [false, true, false, false],
  [BOTTOM]: [true, false, false, false],
  [LEFT]: [false, false, false, true],
  [RIGHT]: [false, false, true, false],
};

/** Lengths of the ships the player has drawn and closed off with water (or the board edge). */
function finished(n: number, cells: number[]): number[] {
  const out: number[] = [];
  const closed = (r: number, c: number) => r < 0 || r >= n || c < 0 || c >= n || cells[r * n + c] === SEA;
  const ship = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c] === SHIP;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!ship(r, c)) continue;
      const [u, l, d, rt] = [ship(r - 1, c), ship(r, c - 1), ship(r + 1, c), ship(r, c + 1)];
      if (!u && !l && !d && !rt) {
        if (closed(r - 1, c) && closed(r + 1, c) && closed(r, c - 1) && closed(r, c + 1)) out.push(1);
      } else if (!l && rt && !u && !d) {
        let e = c;
        while (ship(r, e + 1)) e++;
        if (closed(r, c - 1) && closed(r, e + 1)) out.push(e - c + 1);
      } else if (!u && d && !l && !rt) {
        let e = r;
        while (ship(e + 1, c)) e++;
        if (closed(r - 1, c) && closed(e + 1, c)) out.push(e - r + 1);
      }
    }
  }
  return out;
}

export const battleships: GameModule<BattleshipsPuzzle, BattleshipsState> = {
  id: 'battleships',
  title: 'Battleships',
  blurb: 'Find the hidden fleet from the row and column counts.',
  icon: `<svg viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 9a2 2 0 012-2h10a2 2 0 012 2v0a2 2 0 01-2 2H7a2 2 0 01-2-2z" fill="currentColor"/><circle cx="23" cy="9" r="2.4" fill="currentColor"/><rect x="5" y="16" width="5" height="9" rx="2.5" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6"><path d="M14 18c1.5-1 3-1 4.500 0s3 1 4.500 0M14 23c1.500-1 3-1 4.500 0s3 1 4.500 0"/></g></svg>`,
  variants: VARIANTS.map(({ id, label }) => ({ id, label })),
  defaultVariant: DEFAULT_VARIANT,
  settings: [{ id: 'autowater', label: 'Auto-fill water diagonal to ships', default: true }],
  newState: (p) => ({ cells: initial(p) }),
  isSolved: (p, s) => s.cells.every((v, i) => (v === SHIP) === p.solution[i]),
  mistakes: (p, s) =>
    s.cells.flatMap((v, i) =>
      p.givens[i] === UNKNOWN && ((v === SHIP && !p.solution[i]) || (v === SEA && p.solution[i])) ? [i] : [],
    ),
  hasProgress: (p, s) => s.cells.some((v, i) => p.givens[i] === UNKNOWN && v !== EMPTY),
  isValidSave: (p, s) => Array.isArray(s?.cells) && s.cells.length === p.size * p.size,

  mount(ctx) {
    const { board } = ctx;
    const { size: n, fleet, givens, rowCounts, colCounts } = ctx.puzzle;
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', t('Battleships board'));
    const eb = buildEdgeBoard(board, n, n, { top: true, left: true });
    eb.cells.forEach((cell) => cell.append(el('span', 'ship')));
    eb.top.forEach((c, k) => (c.textContent = String(colCounts[k])));
    eb.left.forEach((c, k) => (c.textContent = String(rowCounts[k])));
    ctx.fit(eb.cols, eb.rows);

    // The fleet, longest ships first; ships tick off as the player closes them in.
    const fleetBox = el('div', 'fleet');
    fleetBox.setAttribute('role', 'group');
    fleetBox.setAttribute('aria-label', t('Fleet'));
    const fleetShips: { len: number; nth: number; node: HTMLElement }[] = [];
    for (let len = fleet.length; len >= 1; len--) {
      for (let nth = 0; nth < fleet[len - 1]; nth++) {
        const node = el('span', 'fleet-ship');
        for (let k = 0; k < len; k++) node.append(el('i'));
        fleetBox.append(node);
        fleetShips.push({ len, nth, node });
      }
    }
    ctx.toolbar.append(fleetBox, el('p', 'hint', t('Tap: water → ship → clear. Drag to paint.')));

    const render = () => {
      const s = ctx.state.cells;
      const shipAt = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n && s[r * n + c] === SHIP;
      const rows = new Array(n).fill(0);
      const cols = new Array(n).fill(0);
      eb.cells.forEach((cell, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const v = s[i];
        cell.classList.toggle('is-water', v === SEA);
        cell.classList.toggle('is-ship', v === SHIP);
        cell.classList.toggle('given', givens[i] !== UNKNOWN);
        cell.classList.remove('wrong');
        let clash = false;
        if (v === SHIP) {
          rows[r]++;
          cols[c]++;
          const imp = IMPLIED[givens[i]] ?? [false, false, false, false];
          const [u, d, l, rt] = [shipAt(r - 1, c) || imp[0], shipAt(r + 1, c) || imp[1], shipAt(r, c - 1) || imp[2], shipAt(r, c + 1) || imp[3]];
          const pad = 3;
          const el0 = cell.firstElementChild as HTMLElement;
          el0.style.inset = `${u ? 0 : pad}px ${rt ? 0 : pad}px ${d ? 0 : pad}px ${l ? 0 : pad}px`;
          // A revealed middle piece is square even before its neighbours are known.
          const rad = (a: boolean, b: boolean) => (a || b || givens[i] === MIDDLE ? '0' : '50%');
          el0.style.borderRadius = `${rad(u, l)} ${rad(u, rt)} ${rad(d, rt)} ${rad(d, l)}`;
          clash =
            shipAt(r - 1, c - 1) || shipAt(r - 1, c + 1) || shipAt(r + 1, c - 1) || shipAt(r + 1, c + 1) ||
            ((shipAt(r, c - 1) || shipAt(r, c + 1)) && (shipAt(r - 1, c) || shipAt(r + 1, c)));
        }
        cell.classList.toggle('clash', clash);
        cell.setAttribute('aria-label', `${t('Row {r}, column {c}', { r: r + 1, c: c + 1 })}: ${t(NAMES[v])}${givens[i] !== UNKNOWN ? `, ${t('given')}` : ''}`);
      });
      const mark = (clue: HTMLElement, have: number, want: number) => {
        clue.classList.toggle('done', have === want);
        clue.classList.toggle('bad', have > want);
      };
      eb.top.forEach((c, k) => mark(c, cols[k], colCounts[k]));
      eb.left.forEach((c, k) => mark(c, rows[k], rowCounts[k]));
      const have = new Array(fleet.length + 1).fill(0);
      for (const len of finished(n, s)) if (len <= fleet.length) have[len]++;
      const solved = battleships.isSolved(ctx.puzzle, ctx.state);
      for (const { len, nth, node } of fleetShips) node.classList.toggle('found', solved || nth < have[len]);
    };

    const stop = cyclePaint({
      board,
      canEdit: () => !ctx.finished,
      locked: (i) => givens[i] !== UNKNOWN,
      get: (i) => ctx.state.cells[i],
      set: (i, v) => {
        const cells = ctx.state.cells;
        cells[i] = v;
        // Ships never touch diagonally, so those squares are always water.
        if (v === SHIP && ctx.setting('autowater')) {
          const [r, c] = [Math.floor(i / n), i % n];
          for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const [rr, cc] = [r + dr, c + dc];
            if (rr >= 0 && rr < n && cc >= 0 && cc < n && cells[rr * n + cc] === EMPTY) cells[rr * n + cc] = SEA;
          }
        }
      },
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
