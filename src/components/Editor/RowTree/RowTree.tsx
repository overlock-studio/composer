import React from 'react';
import {
  ROW_TREE_GAP,
  ROW_TREE_INDENT,
  ROW_TREE_RADIUS,
  ROW_TREE_REACH,
  ROW_TREE_STEM,
  type PathRow,
} from '../../../lib/editorUtils';

// Column a row's own elbow stands in, and the one an ancestor's line runs
// down: the tree is a grid of indent steps, the line a little way into each.
// The half pixel puts a one pixel stroke on a pixel centre, not across two.
const treeColumn = (depth: number): number =>
  (depth - 1) * ROW_TREE_INDENT + ROW_TREE_STEM + 0.5;

/**
 * The lines placing one row in the tree, drawn rather than spelled out: a row
 * paints the piece of every line that crosses it, so the verticals meet across
 * the gaps between rows instead of breaking at each glyph.
 *
 * `height` is the row pitch the lines have to span, so consecutive rows join.
 * `mirrored` flips the whole thing for a column whose rows read towards a
 * handle on their right.
 */
const RowTreeComponent = <T,>({
  row,
  height,
  mirrored = false,
}: {
  row: PathRow<T>;
  height: number;
  mirrored?: boolean;
}) => {
  if (!row.depth) return null;

  const width = row.depth * ROW_TREE_INDENT;
  const middle = height / 2 + 0.5;
  const column = treeColumn(row.depth);
  // The turn towards the name is rounded, so the branch eases off its line
  // instead of cornering on it, and stops a hair short of the first letter.
  const elbow =
    `M ${column} ${middle - ROW_TREE_RADIUS}` +
    ` Q ${column} ${middle} ${column + ROW_TREE_RADIUS} ${middle}` +
    ` H ${width - ROW_TREE_GAP}`;

  return (
    <svg
      width={width}
      height={height}
      className="shrink-0 overflow-visible text-muted-foreground"
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
      stroke="currentColor"
      fill="none"
      aria-hidden
    >
      {row.guides.map((guide, depth) =>
        guide ? (
          <line
            key={depth}
            x1={treeColumn(depth + 1)}
            y1={0}
            x2={treeColumn(depth + 1)}
            y2={height}
          />
        ) : null,
      )}
      {/* A first child reaches up past its own row to meet the one it hangs
          from; the rest carry on from the sibling above. A last child hands
          over to the curve rather than running past it. */}
      <line
        x1={column}
        y1={row.isFirst ? -ROW_TREE_REACH : 0}
        x2={column}
        y2={row.isLast ? middle - ROW_TREE_RADIUS : height}
      />
      <path d={elbow} />
    </svg>
  );
};

export const RowTree = React.memo(RowTreeComponent) as typeof RowTreeComponent;
