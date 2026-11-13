import { t } from '../../core/i18n';
import type { GameModule } from '../../core/types';
import { el } from '../../core/util';
import { crosses, DEFAULT_VARIANT, VARIANTS, type BridgesPuzzle } from './logic';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Island radius, in cells. */
const RADIUS = 0.36;
/** A finger within this distance of an island's centre is on that island. */
const ISLAND_HIT = 0.5;
/** A tap within this distance of a possible bridge picks it. */
const EDGE_HIT = 0.3;
/** Spacing of the two lines of a double bridge. */
const SPLIT = 0.075;

export interface BridgesState {
  /** Per possible bridge (see `puzzle.edges`): 0, 1 or 2 bridges drawn. */
  bridges: number[];
}

export const bridges: GameModule<BridgesPuzzle, BridgesState> = {
  id: 'bridges',
  title: 'Bridges',
  blurb: 'Join the islands with bridges to match their numbers.',
  icon: `<svg viewBox="0 0 30 30"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 7h12M9 23h12M7 9v12"/><path d="M23 8.4v13.2M21.2 8.4v13.2" stroke-width="1.5"/></g><g style="fill:var(--surface)" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="4.6"/><circle cx="23" cy="7" r="4.6"/><circle cx="7" cy="23" r="4.6"/><circle cx="23" cy="23" r="4.6"/></g><g font-family="system-ui,sans-serif" font-weight="700" font-size="7" text-anchor="middle" fill="currentColor"><text x="7" y="9.4">2</text><text x="23" y="9.4">3</text><text x="7" y="25.4">2</text><text x="23" y="25.4">3</text></g></svg>`,
  variants: VARIANTS,
  defaultVariant: DEFAULT_VARIANT,
  newState: (p) => ({ bridges: new Array(p.edges.length).fill(0) }),
  isSolved: (p, s) => p.solution.every((v, e) => s.bridges[e] === v),
  mistakes: (p, s) => s.bridges.flatMap((v, e) => (v > p.solution[e] ? [e] : [])),
  hasProgress: (_, s) => s.bridges.some((v) => v > 0),
  isValidSave: (p, s) => Array.isArray(s?.bridges) && s.bridges.length === p.edges.length,

  mount(ctx) {
    const { board } = ctx;
    const { size: n, cells, numbers, edges } = ctx.puzzle;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('Bridges board'));
    board.style.setProperty('--span', String(n));
    board.append(svg);
    const make = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      parent.append(node);
      return node;
    };
    const pos = cells.map((c) => ({ x: (c % n) + 0.5, y: Math.floor(c / n) + 0.5 }));

    // Faint grid dots so the playing field reads as a grid.
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) make('circle', { cx: c + 0.5, cy: r + 0.5, r: 0.04, class: 'pt' });
    const edgeEls = edges.map(([a, b]) => {
      const [pa, pb] = [pos[a], pos[b]];
      make('line', { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: 'guide' });
      const g = make('g', { class: 'bridge' });
      const horiz = pa.y === pb.y;
      const lines = [-SPLIT, 0, SPLIT].map((o) =>
        make('line', { x1: pa.x + (horiz ? 0 : o), y1: pa.y + (horiz ? o : 0), x2: pb.x + (horiz ? 0 : o), y2: pb.y + (horiz ? o : 0) }, g),
      );
      return { g, lines };
    });
    const islandEls = pos.map(({ x, y }, k) => {
      const g = make('g', { class: 'island' });
      make('circle', { cx: x, cy: y, r: RADIUS }, g);
      const label = make('text', { x, y }, g);
      label.textContent = String(numbers[k]);
      return g;
    });
    const crossing = edges.map((e, i) => edges.flatMap((f, j) => (j !== i && crosses(n, cells, e, f) ? [j] : [])));
    ctx.fit(n, n);
    ctx.toolbar.append(el('p', 'hint', t('Tap a bridge to add one, two or none. Drag between islands.')));

    const render = () => {
      const s = ctx.state.bridges;
      const degree = new Array<number>(cells.length).fill(0);
      edges.forEach(([a, b], e) => {
        degree[a] += s[e];
        degree[b] += s[e];
      });
      edgeEls.forEach(({ g, lines }, e) => {
        const v = s[e];
        lines[0].style.display = lines[2].style.display = v === 2 ? 'inline' : 'none';
        lines[1].style.display = v === 1 ? 'inline' : 'none';
        const bad = v > 0 && crossing[e].some((f) => s[f] > 0);
        g.setAttribute('class', `bridge${bad ? ' bad' : ''}`);
      });
      islandEls.forEach((g, k) => {
        const cls = degree[k] > numbers[k] ? ' bad' : degree[k] === numbers[k] ? ' done' : '';
        g.setAttribute('class', `island${cls}`);
      });
    };

    const local = (e: PointerEvent): [number, number] => {
      const r = svg.getBoundingClientRect();
      const k = r.width / n;
      return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
    };
    const islandAt = (x: number, y: number): number => {
      let best = -1;
      let bestD = ISLAND_HIT;
      pos.forEach((p, k) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) [best, bestD] = [k, d];
      });
      return best;
    };
    const edgeNear = (x: number, y: number): number => {
      let best = -1;
      let bestD = EDGE_HIT;
      edges.forEach(([a, b], e) => {
        const [pa, pb] = [pos[a], pos[b]];
        const px = Math.max(Math.min(pa.x, pb.x), Math.min(Math.max(pa.x, pb.x), x));
        const py = Math.max(Math.min(pa.y, pb.y), Math.min(Math.max(pa.y, pb.y), y));
        const d = Math.hypot(px - x, py - y);
        if (d < bestD) [best, bestD] = [e, d];
      });
      return best;
    };
    const edgeBetween = (a: number, b: number): number => edges.findIndex(([p, q]) => (p === a && q === b) || (p === b && q === a));

    let gesture: { id: number; island: number; edge: number; x: number; y: number; moved: boolean; dirty: boolean } | null = null;
    const bump = (e: number) => {
      if (!gesture) return;
      if (!gesture.dirty) ctx.checkpoint();
      gesture.dirty = true;
      ctx.state.bridges[e] = (ctx.state.bridges[e] + 1) % 3;
      render();
    };
    const down = (e: PointerEvent) => {
      if (gesture || !e.isPrimary || ctx.finished) return;
      const [x, y] = local(e);
      const island = islandAt(x, y);
      const edge = island < 0 ? edgeNear(x, y) : -1;
      if (island < 0 && edge < 0) return;
      e.preventDefault();
      gesture = { id: e.pointerId, island, edge, x, y, moved: false, dirty: false };
    };
    const move = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const [x, y] = local(e);
      if (Math.hypot(x - gesture.x, y - gesture.y) > 0.2) gesture.moved = true;
      if (gesture.island < 0) return;
      const cur = islandAt(x, y);
      if (cur >= 0 && cur !== gesture.island) {
        const edge = edgeBetween(gesture.island, cur);
        if (edge >= 0) bump(edge);
        gesture.island = cur;
      }
    };
    const up = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const g = gesture;
      if (g.edge >= 0 && !g.moved) bump(g.edge);
      const dirty = gesture.dirty;
      gesture = null;
      if (dirty) ctx.commit();
    };
    svg.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    return {
      render,
      showMistakes: (wrong) =>
        wrong.forEach((e) => edgeEls[e].g.setAttribute('class', `${edgeEls[e].g.getAttribute('class')} wrong`)),
      destroy() {
        svg.removeEventListener('pointerdown', down);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      },
    };
  },
};
