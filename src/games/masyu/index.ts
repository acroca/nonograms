import { t } from '../../core/i18n';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { BLACK, cellEdges, DEFAULT_VARIANT, edgeCells, edgeCount, NONE, VARIANTS, type MasyuPuzzle } from './logic';

const EMPTY = 0;
const LINE = 1;
const CROSS = 2;
const PAD = 0.5;
/** A finger within this distance (in cells) of a cell centre counts as being on it while dragging. */
const NODE_RADIUS = 0.34;
const DRAG_START = 0.25;
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface MasyuState {
  /** Per edge (see logic.ts): EMPTY, LINE or CROSS. */
  edges: number[];
}

export const masyu: GameModule<MasyuPuzzle, MasyuState> = {
  id: 'masyu',
  title: 'Masyu',
  blurb: 'Draw one loop through every pearl, turning on black and straight on white.',
  icon: `<svg viewBox="0 0 30 30"><path d="M5 7h13a4 4 0 014 4v0a4 4 0 01-4 4H12a4 4 0 00-4 4v0a4 4 0 004 4h13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="18" cy="7" r="3.6" style="fill:var(--surface)" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="19" r="3.6" fill="currentColor"/></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => ({ edges: new Array(edgeCount(p.size)).fill(EMPTY) }),
  isSolved: (p, s) => p.solution.every((on, e) => (s.edges[e] === LINE) === on),
  mistakes: (p, s) => s.edges.flatMap((v, e) => ((v === LINE && !p.solution[e]) || (v === CROSS && p.solution[e]) ? [e] : [])),
  hasProgress: (_, s) => s.edges.some((v) => v !== EMPTY),
  isValidSave: (p, s) => Array.isArray(s?.edges) && s.edges.length === edgeCount(p.size),

  mount(ctx) {
    const { board } = ctx;
    const { size: n, pearls } = ctx.puzzle;
    const total = edgeCount(n);
    board.style.setProperty('--span', String(n));
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${n} ${n}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('Masyu board'));
    board.append(svg);
    const make = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      parent.append(node);
      return node;
    };
    const xy = (i: number): [number, number] => [i % n, Math.floor(i / n)];
    // Lattice of faint dots, then edges, then pearls on top.
    for (let i = 0; i < n * n; i++) make('circle', { cx: xy(i)[0], cy: xy(i)[1], r: 0.05, class: 'dot' });
    const edgeEls = Array.from({ length: total }, (_, e) => {
      const [a, b] = edgeCells(n, e);
      const [x1, y1] = xy(a);
      const [x2, y2] = xy(b);
      const g = make('g', { class: 'edge' });
      make('line', { x1, y1, x2, y2, class: 'ln' }, g);
      const [mx, my, d] = [(x1 + x2) / 2, (y1 + y2) / 2, 0.09];
      make('path', { d: `M${mx - d} ${my - d}L${mx + d} ${my + d}M${mx + d} ${my - d}L${mx - d} ${my + d}`, class: 'x' }, g);
      return g;
    });
    const pearlEls = pearls.map((kind, i) =>
      kind === NONE ? null : make('circle', { cx: xy(i)[0], cy: xy(i)[1], r: 0.3, class: kind === BLACK ? 'pearl black' : 'pearl white' }),
    );
    ctx.fit(n, n);
    ctx.toolbar.append(el('p', 'hint', t('Tap a gap: line → ✕ → empty. Drag cell to cell to draw.')));

    const render = () => {
      const s = ctx.state.edges;
      edgeEls.forEach((g, e) => g.setAttribute('class', `edge${s[e] === LINE ? ' on' : s[e] === CROSS ? ' off' : ''}`));
      pearlEls.forEach((node, i) => {
        if (!node) return;
        const [u, d, l, r] = cellEdges(n, i).map((e) => e >= 0 && s[e] === LINE);
        const degree = [u, d, l, r].filter(Boolean).length;
        const straight = (u && d) || (l && r);
        const bent = (u || d) && (l || r);
        const bad = degree > 2 || (pearls[i] === BLACK ? straight : bent);
        node.setAttribute('class', `pearl ${pearls[i] === BLACK ? 'black' : 'white'}${bad ? ' bad' : ''}`);
      });
    };

    const local = (e: PointerEvent): [number, number] => {
      const r = svg.getBoundingClientRect();
      const k = r.width / n;
      return [(e.clientX - r.left) / k - PAD, (e.clientY - r.top) / k - PAD];
    };
    const nodeNear = (x: number, y: number, radius: number): number | null => {
      const [c, r] = [Math.round(x), Math.round(y)];
      if (c < 0 || r < 0 || c >= n || r >= n || Math.hypot(x - c, y - r) > radius) return null;
      return r * n + c;
    };
    const edgeBetween = (a: number, b: number): number | null => {
      for (const e of cellEdges(n, a)) if (e >= 0 && edgeCells(n, e).includes(b)) return e;
      return null;
    };
    const nearestEdge = (x: number, y: number): number | null => {
      let best: number | null = null;
      let bestD = 0.45;
      for (let e = 0; e < total; e++) {
        const [a, b] = edgeCells(n, e);
        const [[x1, y1], [x2, y2]] = [xy(a), xy(b)];
        const d = Math.hypot(Math.max(Math.min(x1, x2), Math.min(Math.max(x1, x2), x)) - x, Math.max(Math.min(y1, y2), Math.min(Math.max(y1, y2), y)) - y);
        if (d < bestD) [best, bestD] = [e, d];
      }
      return best;
    };

    let g: { id: number; x0: number; y0: number; x: number; y: number; node: number | null; moved: boolean; paint: number | null; dirty: boolean } | null = null;
    const set = (e: number, v: number) => {
      if (ctx.state.edges[e] === v) return;
      if (!g!.dirty) ctx.checkpoint();
      g!.dirty = true;
      ctx.state.edges[e] = v;
    };
    const visit = (x: number, y: number) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(x - g!.x, y - g!.y) / 0.1));
      for (let k = 1; k <= steps; k++) {
        const node = nodeNear(g!.x + ((x - g!.x) * k) / steps, g!.y + ((y - g!.y) * k) / steps, NODE_RADIUS);
        if (node === null || node === g!.node) continue;
        const e = g!.node === null ? null : edgeBetween(g!.node, node);
        g!.node = node;
        if (e === null) continue;
        g!.paint ??= ctx.state.edges[e] === LINE ? EMPTY : LINE;
        set(e, g!.paint);
      }
      g!.x = x;
      g!.y = y;
    };
    const down = (e: PointerEvent) => {
      if (g || !e.isPrimary || ctx.finished) return;
      e.preventDefault();
      const [x, y] = local(e);
      g = { id: e.pointerId, x0: x, y0: y, x, y, node: nodeNear(x, y, 0.5), moved: false, paint: null, dirty: false };
    };
    const move = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      const [x, y] = local(e);
      if (!g.moved && Math.hypot(x - g.x0, y - g.y0) < DRAG_START) return;
      g.moved = true;
      const before = g.dirty;
      visit(x, y);
      if (g.dirty || before) render();
    };
    const up = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      if (!g.moved && e.type === 'pointerup') {
        const edge = nearestEdge(g.x0, g.y0);
        if (edge !== null) set(edge, (ctx.state.edges[edge] + 1) % 3);
      }
      const { dirty } = g;
      g = null;
      if (dirty) ctx.commit();
    };
    board.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    return {
      render,
      showMistakes: (wrong) => wrong.forEach((e) => edgeEls[e].classList.add('wrong')),
      destroy() {
        board.removeEventListener('pointerdown', down);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      },
    };
  },
};
