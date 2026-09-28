import { createContext, useContext } from 'react';

/**
 * Edges kept in full view beyond the ones touching what has the focus: the
 * relay from a selected block's outputs, through Status, to the blocks that
 * read them. Each edge only knows its own two ends, so the canvas works these
 * out and hands them down.
 */
export const EdgeFocusContext = createContext<ReadonlySet<string>>(new Set());

export const useFocusedEdges = (): ReadonlySet<string> =>
  useContext(EdgeFocusContext);
