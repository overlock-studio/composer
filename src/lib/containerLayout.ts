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

export type ContainerLayout = {
  groups: Record<string, LayoutBox>;
  connectors: Partial<Record<'input' | 'output', ConnectorLayout>>;
};

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

// Room between the two columns of a chess layout, for the edges running from
// one block to the next, and between blocks sharing a column.
const CHESS_COLUMN_GAP = 80;
const CHESS_ROW_GAP = 40;

/**
 * Where block `index` goes when there is no layout saying where it is: two
 * columns, each block half a step below the one before it and in the other
 * column, like the squares of one colour on a chessboard. Neighbours sit
 * diagonally, so the edges between them and to the Spec and Status nodes fan
 * out instead of running down one line.
 */
export const chessPosition = (
  index: number,
  origin: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } => ({
  x: origin.x + (index % 2) * (size.width + CHESS_COLUMN_GAP),
  y: origin.y + (index * (size.height + CHESS_ROW_GAP)) / 2,
});
