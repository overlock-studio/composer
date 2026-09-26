'use client';
import React, { useMemo, useState } from 'react';
import {
  Handle,
  Node,
  NodeProps,
  Position,
  useConnection,
} from '@xyflow/react';
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
import { RowTree } from '../RowTree';
import { useDraggedHandleType } from '../../../lib/useDraggedHandleType';
import { isConnectorGroupId } from '../../../lib/containerGraph';
import {
  connectorRowHandleId,
  pathRows,
  connectorGroupHeight,
  CONNECTOR_GROUP_FOOTER_HEIGHT,
  CONNECTOR_GROUP_HEADER_HEIGHT,
  CONNECTOR_GROUP_ROW_HEIGHT,
} from '../../../lib/editorUtils';

// Handles sit against the node box rather than the row they belong to, so each
// one is offset past the header onto the centre line of its own row.
const rowCentre = (index: number): number =>
  CONNECTOR_GROUP_HEADER_HEIGHT +
  index * CONNECTOR_GROUP_ROW_HEIGHT +
  CONNECTOR_GROUP_ROW_HEIGHT / 2;

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
 * inputs to the left of the blocks, outputs to their right. Rather than a box,
 * each is drawn as the one side facing the blocks: a vertical line the handles
 * hang off, rounded at both ends, with the title on top. Each row is a
 * labelled handle, the whole list moves as one node, and the + under the rows
 * adds another connector.
 */
const ConnectorGroupNodeComponent = ({
  data,
}: NodeProps<Node<ConnectorGroupNodeData>>) => {
  const { connection, connectors, setConnectors } = data;
  const isInput = connection === 'input';
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Connector | null>(null);
  const [deleting, setDeleting] = useState<Connector | null>(null);
  const draggedFrom = useDraggedHandleType();

  const rows = useMemo(() => pathRows(connectors), [connectors]);
  // Connectors are the composite's own fields, so each node is named after the
  // part of the schema it holds rather than the direction it points in.
  const title = isInput ? 'Spec' : 'Status';
  // Rows read outwards, so they sit as close to their own handles as the
  // handle itself leaves room for.
  const rowSide = isInput
    ? 'justify-end pr-[17px] pl-2'
    : 'justify-start pl-[17px] pr-2';

  // An edge dragged from a block handle this node could wire to can be
  // dropped on the + to add a connector for it, so the + lights up meanwhile.
  const takesDrop = draggedFrom === (isInput ? 'target' : 'source');
  // A block input dragged here reads the status field back, so each Status row
  // swaps its dot for the source handle hidden under it until the drag ends.
  const fromBlock = useConnection(
    (state) => state.inProgress && !isConnectorGroupId(state.fromNode.id),
  );
  const readsStatus = !isInput && fromBlock && draggedFrom === 'target';

  const addButton = (
    <Button
      size="icon"
      variant="ghost"
      className={`h-6 w-6 [&_svg]:size-3.5 ${takesDrop ? 'bg-accent text-accent-foreground ring-1 ring-sidebar-primary' : ''}`}
      data-connector-add={connection}
      onClick={() => setAddOpen(true)}
      aria-label={`Add ${title.toLowerCase()} field`}
    >
      <Plus />
    </Button>
  );

  return (
    <div
      className={`node-body connector-group-body ${isInput ? 'connector-group-body-spec' : 'connector-group-body-status'}`}
      style={
        {
          minHeight: connectorGroupHeight(rows.length),
          '--connector-group-header-height': `${CONNECTOR_GROUP_HEADER_HEIGHT}px`,
        } as React.CSSProperties
      }
    >
      {/* The title sits on top of the side line. */}
      <div
        className={`flex items-center px-2 ${isInput ? 'justify-end' : 'justify-start'}`}
        style={{ height: CONNECTOR_GROUP_HEADER_HEIGHT }}
      >
        <div className="text-sm font-medium">{title}</div>
      </div>

      <div className="flex flex-col">
        {rows.map((row, index) => {
          // The tree sits in the label, on the side the handle is on, so the
          // branches point back at the row they hang from.
          const treeLabel = (
            <span className="flex min-w-0 items-center">
              {!isInput && (
                <RowTree row={row} height={CONNECTOR_GROUP_ROW_HEIGHT} />
              )}
              <span className="min-w-0 truncate">{row.name}</span>
              {isInput && (
                <RowTree
                  row={row}
                  height={CONNECTOR_GROUP_ROW_HEIGHT}
                  mirrored
                />
              )}
            </span>
          );
          // A branch row materialised from the path segments has no connector
          // of its own to edit or delete.
          const actions = row.item && (
            <ConnectorRowActions
              connector={row.item}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          );

          return (
            <React.Fragment key={row.path}>
              <CustomHandle
                type={isInput ? 'source' : 'target'}
                position={isInput ? Position.Right : Position.Left}
                id={connectorRowHandleId(row.path, connection)}
                style={{ top: `${rowCentre(index)}px` }}
                // Either end can start an edge, and while one is being drawn
                // only rows of the other type can take it. A Status row takes
                // a block input too, on its read handle.
                isConnectable={!isInput || draggedFrom !== 'source'}
                inactiveClass={'opacity-30'}
                path={row.path}
                description={row.item?.description ?? ''}
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
              {!isInput && (
                <Handle
                  type="source"
                  position={Position.Left}
                  id={connectorRowHandleId(row.path, connection, 'source')}
                  style={{ top: `${rowCentre(index)}px` }}
                  // Only ever the end of an edge: starting one from the row
                  // still draws a write, from its dot.
                  isConnectableStart={false}
                  className={`status-read-handle ${readsStatus ? 'is-armed' : ''}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* The + closes the list, next to the line like one more row. */}
      <div
        className={`flex items-center ${isInput ? 'justify-end pr-[17px]' : 'justify-start pl-[17px]'}`}
        style={{ height: CONNECTOR_GROUP_FOOTER_HEIGHT }}
      >
        {addButton}
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
