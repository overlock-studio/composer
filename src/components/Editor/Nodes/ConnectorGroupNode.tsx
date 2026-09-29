'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Handle,
  Node,
  NodeProps,
  Position,
  useConnection,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  arrangeForStatusSide,
  connectorGroupId,
  connectorNodeHeight,
  holdsResourceBlocks,
  isConnectorGroupId,
  statusNodePosition,
} from '../../../lib/containerGraph';
import { useEditorActions } from '../EditorAreaContext';
import { DEFAULT_STATUS_SIDE } from '../../../lib/containerLayout';
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
 * inputs to the left of the blocks, outputs under them, or right of the blocks
 * when the container is switched that way. Rather than a box,
 * each is drawn as the one side facing the blocks: a vertical line the handles
 * hang off, rounded at both ends, with the title on top. Each row is a
 * labelled handle, the whole list moves as one node, and the + under the rows
 * adds another connector.
 */
const ConnectorGroupNodeComponent = ({
  id,
  data,
}: NodeProps<Node<ConnectorGroupNodeData>>) => {
  const { connection, connectors, setConnectors } = data;
  const isInput = connection === 'input';
  const side = data.side ?? (isInput ? 'left' : DEFAULT_STATUS_SIDE);
  // A node left of the blocks faces right, towards them, and the other way
  // round: its line, handles and rows all sit on the side facing the blocks.
  const facesRight = side === 'left';
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Connector | null>(null);
  const [deleting, setDeleting] = useState<Connector | null>(null);
  const draggedFrom = useDraggedHandleType();
  const { setNodes } = useEditorActions();
  const updateNodeInternals = useUpdateNodeInternals();

  // Flipping sides turns every handle around, which React Flow only picks up
  // once it measures the node again.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, side, updateNodeInternals]);

  const rows = useMemo(() => pathRows(connectors), [connectors]);
  // Connectors are the composite's own fields, so each node is named after the
  // part of the schema it holds rather than the direction it points in.
  const title = isInput ? 'Spec' : 'Status';
  // Rows read outwards, so they sit as close to their own handles as the
  // handle itself leaves room for.
  const rowSide = facesRight
    ? 'justify-end pr-[17px] pl-2'
    : 'justify-start pl-[17px] pr-2';

  // Each row shows one dot: the kind of handle that side of the blocks meets.
  // Spec rows only start edges. A Status row also ends them — the writes when
  // it stands left like Spec, the reads when it stands right — on a handle
  // hidden under the dot until a block handle of the dot's own kind is dragged.
  const dotType = facesRight ? 'source' : 'target';
  const hiddenType = dotType === 'source' ? 'target' : 'source';
  const fromBlock = useConnection(
    (state) => state.inProgress && !isConnectorGroupId(state.fromNode.id),
  );
  const armed = !isInput && fromBlock && draggedFrom === dotType;

  // An edge dragged from a block handle this node could wire to can be
  // dropped on the + to add a connector for it, so the + lights up meanwhile.
  const takesDrop = draggedFrom === (isInput ? 'target' : 'source');

  // Blocks turn their outputs to follow, so they are laid out again first and
  // the node then stands against where they ended up.
  const flipSide = () =>
    setNodes((current) => {
      const next = side === 'left' ? 'right' : 'left';
      const nodes = arrangeForStatusSide(current, next);
      const spec = nodes.find((node) => node.id === connectorGroupId('input'));
      const specRows = pathRows(
        (spec?.data as ConnectorGroupNodeData | undefined)?.connectors ?? [],
      ).length;
      const position = statusNodePosition(
        next,
        nodes.filter(holdsResourceBlocks),
        {
          x: spec?.position.x ?? 0,
          y: spec?.position.y ?? 0,
          height: connectorNodeHeight(spec, specRows),
        },
      );
      return nodes.map((node) =>
        node.id === id
          ? { ...node, position, data: { ...node.data, side: next } }
          : node,
      );
    });

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
      className={`node-body connector-group-body ${facesRight ? 'connector-group-body-faces-right' : 'connector-group-body-faces-left'}`}
      style={
        {
          minHeight: connectorGroupHeight(rows.length),
          '--connector-group-header-height': `${CONNECTOR_GROUP_HEADER_HEIGHT}px`,
        } as React.CSSProperties
      }
    >
      {/* The title sits on top of the side line. */}
      <div
        className={`flex items-center gap-1 px-2 ${facesRight ? 'justify-end' : 'justify-start'}`}
        style={{ height: CONNECTOR_GROUP_HEADER_HEIGHT }}
      >
        <div className="text-sm font-medium">{title}</div>
        {!isInput && (
          <Button
            size="icon"
            variant="ghost"
            className="nodrag nopan h-5 w-5 [&_svg]:size-3"
            onClick={flipSide}
            aria-label={`Move status to the ${side === 'left' ? 'right' : 'left'}`}
            title={`Move status to the ${side === 'left' ? 'right' : 'left'}`}
          >
            <ArrowLeftRight />
          </Button>
        )}
      </div>

      <div className="flex flex-col">
        {rows.map((row, index) => {
          // The tree sits in the label, on the side the handle is on, so the
          // branches point back at the row they hang from.
          const treeLabel = (
            <span className="flex min-w-0 items-center">
              {!facesRight && (
                <RowTree row={row} height={CONNECTOR_GROUP_ROW_HEIGHT} />
              )}
              <span className="min-w-0 truncate">{row.name}</span>
              {facesRight && (
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
          const position = facesRight ? Position.Right : Position.Left;

          return (
            <React.Fragment key={row.path}>
              <CustomHandle
                type={dotType}
                position={position}
                id={connectorRowHandleId(row.path, connection, dotType)}
                style={{ top: `${rowCentre(index)}px` }}
                // Either end can start an edge, and while one is being drawn
                // only rows of the other type can take it. A Status row takes
                // either, the other kind on its hidden handle.
                isConnectable={!isInput || draggedFrom !== 'source'}
                inactiveClass={'opacity-30'}
                className={isInput ? 'spec-handle' : 'status-handle'}
                path={row.path}
                description={row.item?.description ?? ''}
                variant="block"
                labelClassName={`group/row flex w-full items-center gap-1 ${rowSide}`}
                label={
                  facesRight ? (
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
                  type={hiddenType}
                  position={position}
                  id={connectorRowHandleId(row.path, connection, hiddenType)}
                  style={{ top: `${rowCentre(index)}px` }}
                  // Only ever the end of an edge: starting one from the row
                  // draws from its dot.
                  isConnectableStart={false}
                  className={`status-handle connector-hidden-handle ${armed ? 'is-armed' : ''}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* The + closes the list, next to the line like one more row. */}
      <div
        className={`flex items-center ${facesRight ? 'justify-end pr-[17px]' : 'justify-start pl-[17px]'}`}
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
