'use client';
import React, { useMemo, useState } from 'react';
import { Node, NodeProps, Position, useConnection } from '@xyflow/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConnectorGroupNodeData } from '../../../lib/types';
import { Connector } from '../../../api/types';
import { CustomHandle } from '../CustomHandle';
import { ConnectorNodeDeletionDialog } from '../ConfirmDeletionDialog';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { EditConnectorsMenu } from '../Menus';
import {
  connectorRowHandleId,
  connectorRows,
  CONNECTOR_GROUP_HEADER_HEIGHT,
  CONNECTOR_GROUP_ROW_HEIGHT,
  CONNECTOR_TREE_INDENT,
  CONNECTOR_TREE_RADIUS,
  CONNECTOR_TREE_REACH,
  type ConnectorRow,
} from '../../../lib/editorUtils';

// Handles sit against the node box rather than the row they belong to, so each
// one is offset past the header onto the centre line of its own row.
const rowCentre = (index: number): number =>
  CONNECTOR_GROUP_HEADER_HEIGHT +
  index * CONNECTOR_GROUP_ROW_HEIGHT +
  CONNECTOR_GROUP_ROW_HEIGHT / 2;

// Column a row's own elbow stands in, and the one an ancestor's line runs
// down: the tree is a grid of indent steps, half a step in from each. The half
// pixel puts a one pixel stroke on a pixel centre rather than across two.
const treeColumn = (depth: number): number =>
  (depth - 1) * CONNECTOR_TREE_INDENT + CONNECTOR_TREE_INDENT / 2 + 0.5;

/**
 * The lines placing one row in the tree, drawn rather than spelled out: a row
 * paints the piece of every line that crosses it, so the verticals meet across
 * the gaps between rows instead of breaking at each glyph.
 *
 * `mirrored` flips the whole thing for Spec, whose rows read towards a handle
 * on their right.
 */
const ConnectorRowTree = ({
  row,
  mirrored,
}: {
  row: ConnectorRow;
  mirrored: boolean;
}) => {
  if (!row.depth) return null;

  const width = row.depth * CONNECTOR_TREE_INDENT;
  const middle = CONNECTOR_GROUP_ROW_HEIGHT / 2 + 0.5;
  const column = treeColumn(row.depth);
  // The turn towards the name is rounded, so the branch eases off its line
  // instead of cornering on it.
  const elbow =
    `M ${column} ${middle - CONNECTOR_TREE_RADIUS}` +
    ` Q ${column} ${middle} ${column + CONNECTOR_TREE_RADIUS} ${middle}` +
    ` H ${width}`;

  return (
    <svg
      width={width}
      height={CONNECTOR_GROUP_ROW_HEIGHT}
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
            y2={CONNECTOR_GROUP_ROW_HEIGHT}
          />
        ) : null,
      )}
      {/* A first child reaches up past its own row to meet the one it hangs
          from; the rest carry on from the sibling above. A last child hands
          over to the curve rather than running past it. */}
      <line
        x1={column}
        y1={row.isFirst ? -CONNECTOR_TREE_REACH : 0}
        x2={column}
        y2={
          row.isLast
            ? middle - CONNECTOR_TREE_RADIUS
            : CONNECTOR_GROUP_ROW_HEIGHT
        }
      />
      <path d={elbow} />
    </svg>
  );
};

const ConnectorRowActions = ({
  connector,
  onEdit,
  onDelete,
}: {
  connector: Connector;
  onEdit: (connector: Connector) => void;
  onDelete: (connector: Connector) => void;
}) => (
  <span className="nodrag nopan flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
    <Button
      size="icon"
      variant="ghost"
      className="h-4 w-4 [&_svg]:size-3"
      onClick={() => onEdit(connector)}
      aria-label="Edit connector"
    >
      <Pencil />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      className="h-4 w-4 [&_svg]:size-3 hover:text-red-400"
      onClick={() => onDelete(connector)}
      aria-label="Delete connector"
    >
      <Trash2 />
    </Button>
  </span>
);

/**
 * One of the two nodes a container's connectors live in while it is open:
 * inputs to the left of the blocks, outputs to their right. Each row is a
 * labelled handle, the whole list moves as one node, and the header's + adds
 * another connector.
 */
const ConnectorGroupNodeComponent = ({
  data,
}: NodeProps<Node<ConnectorGroupNodeData>>) => {
  const { connection, connectors, setConnectors } = data;
  const isInput = connection === 'input';
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Connector | null>(null);
  const [deleting, setDeleting] = useState<Connector | null>(null);
  const inProgress = !!useConnection()?.inProgress;

  const rows = useMemo(() => connectorRows(connectors), [connectors]);
  // Connectors are the composite's own fields, so each node is named after the
  // part of the schema it holds rather than the direction it points in.
  const title = isInput ? 'Spec' : 'Status';
  const rowSide = isInput
    ? 'justify-end pr-[22px] pl-2'
    : 'justify-start pl-[22px] pr-2';

  const addButton = (
    <Button
      size="icon"
      variant="ghost"
      className="h-6 w-6 [&_svg]:size-3.5"
      onClick={() => setAddOpen(true)}
      aria-label={`Add ${title.toLowerCase()} field`}
    >
      <Plus />
    </Button>
  );

  return (
    <div
      className="node-body"
      style={{
        minHeight: CONNECTOR_GROUP_HEADER_HEIGHT + CONNECTOR_GROUP_ROW_HEIGHT,
      }}
    >
      <div
        className="flex items-center border-b-[2px] border-muted-foreground/20 px-2 rounded-t-lg"
        style={{ height: CONNECTOR_GROUP_HEADER_HEIGHT }}
      >
        {/* The + sits on the side the handles are on, so each node reads
            outwards from the blocks it wires to. */}
        {!isInput && addButton}
        <div className="flex-1 text-center text-sm font-medium">{title}</div>
        {isInput ? addButton : <div className="w-6" />}
      </div>

      <div className="flex flex-col">
        {rows.map((row, index) => {
          // The tree sits in the label, on the side the handle is on, so the
          // branches point back at the row they hang from.
          const treeLabel = (
            <span className="flex min-w-0 items-center">
              {!isInput && <ConnectorRowTree row={row} mirrored={false} />}
              <span className="min-w-0 truncate">{row.name}</span>
              {isInput && <ConnectorRowTree row={row} mirrored />}
            </span>
          );
          // A branch row materialised from the path segments has no connector
          // of its own to edit or delete.
          const actions = row.connector && (
            <ConnectorRowActions
              connector={row.connector}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          );

          return (
            <CustomHandle
              key={row.path}
              type={isInput ? 'source' : 'target'}
              position={isInput ? Position.Right : Position.Left}
              id={connectorRowHandleId(row.path, connection)}
              style={{ top: `${rowCentre(index)}px` }}
              // Either side can start an edge; only an output can end one, and
              // inputs stop being drop targets while a connection is in flight.
              isConnectableStart={true}
              isConnectableEnd={!isInput}
              isConnectable={isInput ? !inProgress : true}
              inactiveClass={'opacity-30'}
              path={row.path}
              description={row.connector?.description ?? ''}
              variant="block"
              labelClassName={`group/row flex w-full items-center gap-1 ${rowSide}`}
              label={
                isInput ? (
                  <>
                    {actions}
                    {treeLabel}
                  </>
                ) : (
                  <>
                    {treeLabel}
                    {actions}
                  </>
                )
              }
            />
          );
        })}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Connector</DialogTitle>
          </DialogHeader>
          <EditConnectorsMenu
            setOpen={setAddOpen}
            setConnectors={setConnectors}
            defaultConnection={connection}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Connector</DialogTitle>
          </DialogHeader>
          {editing && (
            <EditConnectorsMenu
              setOpen={() => setEditing(null)}
              connector={editing}
              setConnectors={setConnectors}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConnectorNodeDeletionDialog
        open={!!deleting}
        nodeId={deleting?.path ?? ''}
        setOpen={() => setDeleting(null)}
        setConnectors={setConnectors}
      />
    </div>
  );
};

export const ConnectorGroupNode = React.memo(ConnectorGroupNodeComponent);
