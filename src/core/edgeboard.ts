import { el } from './util';

export interface EdgeBoardOptions {
  /** Which sides carry a row of clue cells. */
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

export interface EdgeBoard {
  /** The playing cells, row-major, each with `data-i`. */
  cells: HTMLElement[];
  /** Clue cells per column (top, bottom) and per row (left, right); empty arrays for absent sides. */
  top: HTMLElement[];
  bottom: HTMLElement[];
  left: HTMLElement[];
  right: HTMLElement[];
  field: HTMLElement;
  /** Size to pass to `ctx.fit`, in cells. */
  cols: number;
  rows: number;
}

/**
 * Lays out a rows × cols field of cells inside a board with optional clue rows/columns around it. Clue cells are
 * plain `.eclue` elements without `data-i`, so pointer input never starts on them.
 */
export function buildEdgeBoard(board: HTMLElement, rows: number, cols: number, opts: EdgeBoardOptions = {}): EdgeBoard {
  const [T, B, L, R] = [!!opts.top, !!opts.bottom, !!opts.left, !!opts.right];
  board.classList.add('edge-board');
  board.style.gridTemplateColumns = `${L ? 'var(--cell) ' : ''}repeat(${cols}, var(--cell))${R ? ' var(--cell)' : ''}`;
  board.style.gridTemplateRows = `${T ? 'var(--cell) ' : ''}repeat(${rows}, var(--cell))${B ? ' var(--cell)' : ''}`;
  const field = el('div', 'edge-field');
  field.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
  field.style.gridAutoRows = 'var(--cell)';
  field.style.gridArea = `${T ? 2 : 1} / ${L ? 2 : 1} / span ${rows} / span ${cols}`;
  board.append(field);
  const cells = Array.from({ length: rows * cols }, (_, i) => {
    const cell = el('div', 'cell');
    cell.dataset.i = String(i);
    cell.setAttribute('role', 'gridcell');
    field.append(cell);
    return cell;
  });
  const clue = (row: number, col: number) => {
    const c = el('div', 'eclue');
    c.style.gridArea = `${row} / ${col}`;
    board.append(c);
    return c;
  };
  const along = (count: number, on: boolean, place: (k: number) => [number, number]) =>
    on ? Array.from({ length: count }, (_, k) => clue(...place(k))) : [];
  return {
    cells,
    top: along(cols, T, (k) => [1, (L ? 2 : 1) + k]),
    bottom: along(cols, B, (k) => [(T ? 2 : 1) + rows, (L ? 2 : 1) + k]),
    left: along(rows, L, (k) => [(T ? 2 : 1) + k, 1]),
    right: along(rows, R, (k) => [(T ? 2 : 1) + k, (L ? 2 : 1) + cols]),
    field,
    cols: cols + (L ? 1 : 0) + (R ? 1 : 0),
    rows: rows + (T ? 1 : 0) + (B ? 1 : 0),
  };
}
