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
