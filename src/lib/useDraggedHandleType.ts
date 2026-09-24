import { useConnection } from '@xyflow/react';

/**
 * Type of the handle an edge is being dragged from, or null while nothing is
 * being dragged. An edge can be drawn from either end, so handles of this
 * same type are the ones that cannot take the drop.
 */
export const useDraggedHandleType = (): 'source' | 'target' | null =>
  useConnection((connection) =>
    connection.inProgress ? (connection.fromHandle?.type ?? null) : null,
  );
