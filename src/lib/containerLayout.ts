// Layout of what a container draws in edit mode: its pipeline groups and its
// Spec and Status nodes. Kept free of imports so the parser, the graph builder
// and the layout writer can all share it.

/** The pipeline step whose input carries the composition's resources. */
export const PATCH_AND_TRANSFORM_STEP = 'patch-and-transform';

export type LayoutBox = { x: number; y: number; width: number; height: number };

// A connector node follows its rows until the user resizes it, so its size is
// only there once they have.
export type ConnectorLayout = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

/** Which side of the blocks the Status node stands on while a container is open. */
export type StatusSide = 'left' | 'right';

export type ContainerLayout = {
  groups: Record<string, LayoutBox>;
  connectors: Partial<Record<'input' | 'output', ConnectorLayout>>;
  // Left when absent, under Spec and drawn the same way; right stands it on
  // the far side of the blocks, the way their outputs flow.
  statusSide?: StatusSide;
};

/** The side a container keeps Status on unless it says otherwise. */
export const DEFAULT_STATUS_SIDE: StatusSide = 'left';

export const isStatusSide = (value: unknown): value is StatusSide =>
  value === 'left' || value === 'right';

// Resource names are DNS labels and can never start with `_`, so every key the
// editor writes for itself does, the way `_self` already does for the
// container.
export const isReservedLayoutKey = (key: string): boolean =>
  key.startsWith('_');

export const PIPELINE_LAYOUT_PREFIX = '_pipeline:';

export const pipelineLayoutKey = (step: string): string =>
  `${PIPELINE_LAYOUT_PREFIX}${step}`;

export const connectorLayoutKey = (connection: 'input' | 'output'): string =>
  connection === 'input' ? '_spec' : '_status';

// Room between the columns of a chess layout, for the edges running from one
// block to the next, and between blocks sharing a column.
const CHESS_COLUMN_GAP = 80;
const CHESS_ROW_GAP = 40;
// A chess layout grows to the right rather than down: it has this many rows.
// Each column holds every other one, so with an odd count the columns
// starting on the top row hold one block more than the others.
const CHESS_ROWS = 7;

/**
 * Where blocks go when there is no layout saying where they are: a chessboard
 * of `CHESS_ROWS` rows, blocks on the squares of one colour. Each column holds
 * every other row, starting one row lower than the column before it, so
 * neighbours sit diagonally and the edges between them and to the Spec and
 * Status nodes fan out instead of running down one line. Blocks fill a column
 * top to bottom before the next one to the right.
 *
 * Rows are shared by all columns, so the board stays aligned. A row starts
 * half a step below the one above it, and never before the tallest block of
 * the row above that, in the same columns, has ended.
 */
export const chessPositions = (
  heights: number[],
  origin: { x: number; y: number },
  width: number,
): { x: number; y: number }[] => {
  const cells: { column: number; row: number; height: number }[] = [];
  let column = 0;
  let row = 0;
  for (const height of heights) {
    if (row >= CHESS_ROWS) {
      column += 1;
      row = column % 2;
    }
    cells.push({ column, row, height });
    row += 2;
  }

  const tallest = Array.from({ length: CHESS_ROWS }, (_, row) =>
    Math.max(0, ...cells.filter((c) => c.row === row).map((c) => c.height)),
  );
  const rowY = [origin.y];
  for (let row = 1; row < CHESS_ROWS; row++) {
    const halfStep = rowY[row - 1] + (tallest[row - 1] + CHESS_ROW_GAP) / 2;
    const columnFree =
      row >= 2 ? rowY[row - 2] + tallest[row - 2] + CHESS_ROW_GAP : halfStep;
    rowY.push(Math.max(halfStep, columnFree));
  }

  return cells.map(({ column, row }) => ({
    x: origin.x + column * (width + CHESS_COLUMN_GAP),
    y: rowY[row],
  }));
};
