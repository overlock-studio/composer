'use client';
import React, { useMemo, useState } from 'react';
import { Node, NodeProps, Position, useConnection } from '@xyflow/react';
import { Pencil, Trash2 } from 'lucide-react';
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
  connectorLabels,
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
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <span className="nodrag nopan flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
    <Button
      size="icon"
      variant="ghost"
      className="h-4 w-4 [&_svg]:size-3"
      onClick={onEdit}
      aria-label="Edit connector"
    >
      <Pencil />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      className="h-4 w-4 [&_svg]:size-3 hover:text-red-400"
      onClick={onDelete}
      aria-label="Delete connector"
    >
      <Trash2 />
    </Button>
  </span>
);

/**
 * One of the two nodes a container's connectors live in while it is open:
 * inputs to the left of the blocks, outputs to their right. Each row is a
 * labelled handle, the whole list moves as one node, and the trailing row adds
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

  const labels = useMemo(() => connectorLabels(connectors), [connectors]);
  const rowSide = isInput
    ? 'justify-end pr-[22px] pl-2'
    : 'justify-start pl-[22px] pr-2';

  return (
    <div
      className="node-body"
      style={{
        minHeight:
          CONNECTOR_GROUP_HEADER_HEIGHT + CONNECTOR_GROUP_ROW_HEIGHT * 2,
      }}
    >
      <div
        className="flex items-center justify-center border-b-[2px] border-muted-foreground/20 rounded-t-lg text-sm font-medium"
        style={{ height: CONNECTOR_GROUP_HEADER_HEIGHT }}
      >
        {isInput ? 'Inputs' : 'Outputs'}
      </div>

      <div className="flex flex-col">
        {connectors.map((connector, index) => (
          <CustomHandle
            key={connector.path}
            type={isInput ? 'source' : 'target'}
            position={isInput ? Position.Right : Position.Left}
            id={
              isInput ? `source-${connector.path}` : `target-${connector.path}`
            }
            style={{ top: `${rowCentre(index)}px` }}
            // Either side can start an edge; only an output can end one, and
            // inputs stop being drop targets while a connection is in flight.
            isConnectableStart={true}
            isConnectableEnd={!isInput}
            isConnectable={isInput ? !inProgress : true}
            inactiveClass={'opacity-30'}
            path={connector.path}
            description={connector.description}
            variant="block"
            labelClassName={`group/row flex w-full items-center gap-1 ${rowSide}`}
            label={
              <>
                {!isInput && (
                  <span className="min-w-0 truncate">
                    {labels[connector.path]}
                  </span>
                )}
                <ConnectorRowActions
                  onEdit={() => setEditing(connector)}
                  onDelete={() => setDeleting(connector)}
                />
                {isInput && (
                  <span className="min-w-0 truncate">
                    {labels[connector.path]}
                  </span>
                )}
              </>
            }
          />
        ))}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label={`Add ${connection}`}
          className={`nodrag nopan flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground ${rowSide}`}
          style={{ height: CONNECTOR_GROUP_ROW_HEIGHT }}
        >
          Add {connection}
        </button>
      </div>

      {/* Empty handle closing the list, so the add row reads as one more slot. */}
      <span
        className="connector-add-slot"
        style={{
          top: rowCentre(connectors.length),
          ...(isInput ? { right: 0 } : { left: 0 }),
        }}
      />

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
