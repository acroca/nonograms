import type { Example, LineStyle } from './guides';
import { REGION_HUES } from './regions';

const NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

function svg(tag: string, cls = '', attrs: Attrs = {}, text?: string): SVGElement {
  const node = document.createElementNS(NS, tag);
  if (cls) node.setAttribute('class', cls);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

interface Cell {
  /** `cell` is a square of the board; `clue` and `gap` sit outside it (edge numbers, signs between cells). */
  kind: 'cell' | 'clue' | 'gap';
  flags: Set<string>;
  text: string;
}

const FLAGS: Record<string, string> = { '#': 'dark', '*': 'hl', '!': 'bad', '~': 'soft', '%': 'lit' };

/**
 * Parses one token of an example grid.
 *
 * - `.` is an empty square and `_` an empty spot outside the board.
 * - `^text` is a clue outside the board (`_` inside it prints as a space); `<` and `>` are signs between squares.
 * - `down\across` is a Kakuro clue block.
 * - Anything else is a square: optional flags (`#` dark, `*` highlighted, `!` wrong, `~` greyed, `%` lit) followed
 *   by its content, which is plain text or a glyph such as `:x` (see `drawGlyph`).
 */
function parse(tok: string): Cell {
  if (tok === '_') return { kind: 'gap', flags: new Set(), text: '' };
  if (tok === '<' || tok === '>') return { kind: 'gap', flags: new Set(['sign']), text: tok };
  if (tok.startsWith('^')) return { kind: 'clue', flags: new Set(), text: tok.slice(1).replace(/_/g, ' ') };
  if (tok.includes('\\')) return { kind: 'cell', flags: new Set(['kakuro']), text: tok };
  const flags = new Set<string>();
  let i = 0;
  while (i < tok.length && FLAGS[tok[i]]) flags.add(FLAGS[tok[i++]]);
  const text = tok.slice(i);
  return { kind: 'cell', flags, text: text === '.' ? '' : text };
}

/** Draws the content of a square centred on (cx, cy). Glyphs start with `:`; `(n)` is a numbered disc. */
function drawGlyph(out: SVGElement, cell: Cell, cx: number, cy: number) {
  const t = cell.text;
  const disc = /^\((.+?)(?::([a-c]))?\)$/.exec(t);
  if (disc) {
    out.append(svg('circle', disc[2] ? `ex-disc ex-path-${disc[2]}` : 'ex-island', { cx, cy, r: 0.34 }));
    out.append(svg('text', disc[2] ? 'ex-text ex-on-disc' : 'ex-text ex-small', { x: cx, y: cy }, disc[1]));
    return;
  }
  switch (t) {
    case '':
      return;
    case ':x': {
      const d = 0.2;
      out.append(svg('path', 'ex-cross', { d: `M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}` }));
      return;
    }
    case ':dot':
      out.append(svg('circle', 'ex-dot', { cx, cy, r: 0.09 }));
      return;
    case ':o':
      out.append(svg('circle', 'ex-ring', { cx, cy, r: 0.36 }));
      return;
    case ':white':
      out.append(svg('circle', 'ex-pearl-white', { cx, cy, r: 0.27 }));
      return;
    case ':black':
      out.append(svg('circle', 'ex-pearl-black', { cx, cy, r: 0.3 }));
      return;
    case ':water':
      out.append(svg('path', 'ex-water', { d: `M${cx - 0.22} ${cy}q0.11 -0.14 0.22 0t0.22 0` }));
      return;
    case ':ship':
      out.append(svg('rect', 'ex-ship', { x: cx - 0.36, y: cy - 0.36, width: 0.72, height: 0.72 }));
      return;
    case ':ship1':
      out.append(svg('circle', 'ex-ship', { cx, cy, r: 0.36 }));
      return;
    case ':shipl':
    case ':shipr': {
      // A square with one side rounded into a half circle: the end of a ship.
      const s = t === ':shipl' ? -1 : 1;
      const x = cx - s * 0.36;
      out.append(
        svg('path', 'ex-ship', {
          d: `M${x} ${cy - 0.36}H${cx}A0.36 0.36 0 0 ${s === 1 ? 1 : 0} ${cx} ${cy + 0.36}H${x}Z`,
        }),
      );
      return;
    }
    default:
      out.append(svg('text', /\p{Extended_Pictographic}/u.test(t) ? 'ex-text ex-emoji' : 'ex-text', { x: cx, y: cy }, t));
  }
}

const pts = (spec: string, shift: number) =>
  spec
    .trim()
    .split(/\s+/)
    .map((p) => p.split(',').map((n) => Number(n) + shift) as [number, number]);

const poly = (points: [number, number][]) => points.map(([x, y]) => `${x},${y}`).join(' ');

/** Draws one overlay line. Corner coordinates for `edge` and `cross`, square centres for everything else. */
function drawLine(out: SVGElement, style: LineStyle, spec: string) {
  if (style === 'edge') {
    out.append(svg('polyline', 'ex-line ex-loop', { points: poly(pts(spec, 0)) }));
    return;
  }
  if (style === 'cross') {
    for (const [x, y] of pts(spec, 0)) {
      const d = 0.1;
      out.append(svg('path', 'ex-cross ex-cross-small', { d: `M${x - d} ${y - d}L${x + d} ${y + d}M${x + d} ${y - d}L${x - d} ${y + d}` }));
    }
    return;
  }
  const p = pts(spec, 0.5);
  if (style === 'domino') {
    const [[x1, y1], [x2, y2]] = p;
    const x = Math.min(x1, x2) - 0.42;
    const y = Math.min(y1, y2) - 0.42;
    out.append(
      svg('rect', 'ex-domino', { x, y, width: Math.abs(x2 - x1) + 0.84, height: Math.abs(y2 - y1) + 0.84, rx: 0.18 }),
    );
    return;
  }
  if (style === 'bridge2') {
    // A double bridge: the same segment drawn twice, nudged to either side.
    const [[x1, y1], [x2, y2]] = p;
    const dx = y1 === y2 ? 0 : 0.09;
    const dy = y1 === y2 ? 0.09 : 0;
    for (const s of [-1, 1]) {
      out.append(svg('line', 'ex-line ex-bridge', { x1: x1 + s * dx, y1: y1 + s * dy, x2: x2 + s * dx, y2: y2 + s * dy }));
    }
    return;
  }
  const cls = style === 'mercury-gap' ? 'mercury' : style;
  out.append(svg('polyline', `ex-line ex-${cls}`, { points: poly(p) }));
  if (style === 'thermo' || style === 'mercury') {
    out.append(svg('circle', `ex-bulb ex-${style}`, { cx: p[0][0], cy: p[0][1], r: 0.33 }));
  }
}

/** Renders the drawing of an example as an inline SVG, one unit per square. */
export function renderExample(e: Example): SVGElement {
  const cells = (e.grid ?? []).map((row) => row.trim().split(/\s+/).map(parse));
  const rows = cells.length;
  const cols = Math.max(...cells.map((r) => r.length));
  const board = e.board ?? 'grid';
  const pad = 0.08;

  const root = svg('svg', `ex-svg ex-board-${board}`, {
    viewBox: `${-pad} ${-pad} ${cols + 2 * pad} ${rows + 2 * pad}`,
    role: 'img',
    'aria-label': e.caption,
  });
  root.style.setProperty('--cols', String(cols + 2 * pad));

  const at = (x: number, y: number): Cell | undefined => cells[y]?.[x];
  const inBoard = (x: number, y: number) => at(x, y)?.kind === 'cell';
  const region = (x: number, y: number) => {
    const ch = e.regions?.[y]?.trim().split(/\s+/)[x];
    return ch && /[a-z]/.test(ch) ? ch : '';
  };
  const regionStyle = e.regionStyle ?? 'tint';

  const backs = svg('g');
  const thin = svg('g');
  const thick = svg('g');
  const lines = svg('g');
  const glyphs = svg('g');
  const labelled = new Set<string>();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = at(x, y);
      if (!cell) continue;
      const cx = x + 0.5;
      const cy = y + 0.5;

      if (cell.kind !== 'cell') {
        if (cell.text) {
          glyphs.append(svg('text', cell.kind === 'clue' ? 'ex-text ex-clue' : 'ex-text ex-sign', { x: cx, y: cy }, cell.text));
        }
        continue;
      }

      const r = region(x, y);
      if (board === 'grid') {
        const back = svg('rect', 'ex-back', { x, y, width: 1, height: 1 });
        if (r && regionStyle === 'tint') {
          back.style.setProperty('--h', String(REGION_HUES[(r.charCodeAt(0) - 97) % REGION_HUES.length]));
          back.classList.add('ex-tint');
        }
        const stone = cell.flags.has('dark') && back.classList.contains('ex-tint');
        for (const f of cell.flags) if (!stone) back.classList.add(`ex-${f}`);
        backs.append(back);
        // On a tinted region a shaded square is drawn inset, so the region's colour and walls stay visible.
        if (stone) {
          glyphs.append(svg('rect', cell.flags.has('bad') ? 'ex-stone ex-bad' : 'ex-stone', { x: x + 0.1, y: y + 0.1, width: 0.8, height: 0.8, rx: 0.08 }));
        }
      }

      // Walls: thick around the board and between regions, thin elsewhere. Cages get a dashed inner outline.
      const sides: [number, number, string][] = [
        [0, -1, `M${x} ${y}h1`],
        [1, 0, `M${x + 1} ${y}v1`],
        [0, 1, `M${x} ${y + 1}h1`],
        [-1, 0, `M${x} ${y}v1`],
      ];
      const inset = 0.09;
      const cage: [number, number, number, number][] = [
        [x, y + inset, x + 1, y + inset],
        [x + 1 - inset, y, x + 1 - inset, y + 1],
        [x, y + 1 - inset, x + 1, y + 1 - inset],
        [x + inset, y, x + inset, y + 1],
      ];
      sides.forEach(([dx, dy, d], i) => {
        const outer = !inBoard(x + dx, y + dy);
        const border = !outer && region(x + dx, y + dy) !== r;
        if (board !== 'bare') {
          // Only a ruled grid has walls; the other boards get a faint ruling to make the squares countable.
          const strong = board === 'grid' && (outer || (border && regionStyle !== 'cage'));
          // Shared walls are drawn once, from the square above or to the left.
          if (outer || dx + dy > 0) (strong ? thick : thin).append(svg('path', strong ? 'ex-wall' : 'ex-thin', { d }));
        }
        if (r && regionStyle === 'cage' && (outer || border)) {
          // Trim the dashed line where it meets the cage's own corners, so it doesn't poke into the next square.
          let [x1, y1, x2, y2] = cage[i];
          const open = (ddx: number, ddy: number) => inBoard(x + ddx, y + ddy) && region(x + ddx, y + ddy) === r;
          if (dy !== 0) {
            if (!open(-1, 0)) x1 += inset;
            if (!open(1, 0)) x2 -= inset;
          } else {
            if (!open(0, -1)) y1 += inset;
            if (!open(0, 1)) y2 -= inset;
          }
          thin.append(svg('line', 'ex-cage', { x1, y1, x2, y2 }));
        }
      });

      if (cell.flags.has('kakuro')) {
        const [down, across] = cell.text.split('\\');
        backs.lastElementChild?.classList.add('ex-dark');
        glyphs.append(svg('line', 'ex-diagonal', { x1: x, y1: y, x2: x + 1, y2: y + 1 }));
        if (across) glyphs.append(svg('text', 'ex-text ex-kakuro', { x: x + 0.7, y: y + 0.32 }, across));
        if (down) glyphs.append(svg('text', 'ex-text ex-kakuro', { x: x + 0.3, y: y + 0.7 }, down));
        continue;
      }

      const label = r && !labelled.has(r) ? e.labels?.[r] : undefined;
      if (label) {
        labelled.add(r);
        glyphs.append(svg('text', 'ex-text ex-label', { x: x + (regionStyle === 'cage' ? 0.15 : 0.08), y: y + (regionStyle === 'cage' ? 0.26 : 0.2) }, label));
      }

      const caged = !!e.labels && regionStyle !== 'tint';
      const g = svg('g', [...cell.flags].map((f) => `ex-on-${f}`).concat(caged ? ['ex-caged'] : []).join(' '));
      // A digit shares its square with a cage label by being smaller and sitting a little lower.
      drawGlyph(g, cell, cx, caged ? cy + 0.1 : cy);
      glyphs.append(g);
    }
  }

  if (board === 'dots' || board === 'centres') {
    const shift = board === 'dots' ? 0 : 0.5;
    const max = board === 'dots' ? 1 : 0;
    for (let y = 0; y < rows + max; y++) {
      for (let x = 0; x < cols + max; x++) {
        lines.append(svg('circle', board === 'dots' ? 'ex-node' : 'ex-centre', { cx: x + shift, cy: y + shift, r: board === 'dots' ? 0.07 : 0.035 }));
      }
    }
  }

  for (const [style, spec] of e.lines ?? []) drawLine(lines, style, spec);

  root.append(backs, thin, thick, lines, glyphs);
  return root;
}
