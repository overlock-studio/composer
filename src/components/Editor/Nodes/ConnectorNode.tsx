'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { ConnectorNodeData } from '../../../lib/types';
import { Node, NodeProps, Position, useConnection } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { CustomHandle } from '../CustomHandle';
import { ConnectorNodeToolbar } from '../Toolbars/ConnectorNodeToolbar';
import { ConnectorNodeDeletionDialog } from '../ConfirmDeletionDialog';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { EditConnectorsMenu } from '../Menus';
import { Connector } from '../../../api/types';

type ConnectorSetter = React.Dispatch<React.SetStateAction<Connector[]>>;

/**
 * Trailing slot of a connector column: an empty handle that opens the connector
 * form, so a column can be extended without leaving the canvas.
 */
const ConnectorAddSlot = ({
  connection,
  setConnectors,
}: {
  connection: 'input' | 'output';
  setConnectors: ConnectorSetter;
}) => {
  const [open, setOpen] = useState(false);
  const isInput = connection === 'input';

  return (
    <div className="connector-no-glow">
      <button
        type="button"
        aria-label={`Add ${connection}`}
        onClick={() => setOpen(true)}
        className="connector-add-slot nodrag nopan"
        style={isInput ? { right: '33%' } : { left: '32%' }}
      >
        <Plus />
      </button>
      <span
        className="connector-add-label"
        style={
          isInput
            ? { right: '100%', marginRight: '-7px' }
            : { left: '100%', marginLeft: '-7px' }
        }
      >
        Add {connection}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Connector</DialogTitle>
          </DialogHeader>
          <EditConnectorsMenu
            setOpen={setOpen}
            setConnectors={setConnectors}
            defaultConnection={connection}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ConnectorHandleNode = ({
  id,
  connector,
  label,
  setConnectors,
  selected,
}: {
  id: string;
  connector: Connector;
  label?: string;
  setConnectors: ConnectorSetter;
  selected?: boolean;
}) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  useNodeDeleteShortcut(selected, () => setOpenDeleteDialog(true));
  const connection = useConnection();

  const isInProgress = useMemo(() => connection?.inProgress, [connection]);

  const getIsConnectable = useCallback(
    (type: string) => ({
      isConnectable: !(isInProgress && type === 'source'),
    }),
    [isInProgress],
  );

  const commonHandleStyle = { top: '50%', transform: 'translateY(-50%)' };

  return (
    <div className="connector-no-glow">
      <ConnectorNodeToolbar
        connector={connector}
        setConnectors={setConnectors}
        onRequestDelete={() => setOpenDeleteDialog(true)}
      />
      <ConnectorNodeDeletionDialog
        open={openDeleteDialog}
        nodeId={connector.path}
        setOpen={setOpenDeleteDialog}
        setConnectors={setConnectors}
      />
      {connector.connection === 'output' && (
        <CustomHandle
          key={`target-${id}`}
          type="target"
          position={Position.Left}
          id={`target-${connector.path}`}
          isConnectableStart={true}
          inactiveClass={'opacity-30'}
          {...getIsConnectable('target')}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            left: '32%',
            right: 'unset',
          }}
          path={connector.path}
          label={label}
          description={connector.description}
          variant="container"
        />
      )}
      {connector.connection !== 'output' && (
        <CustomHandle
          key={`source-${id}`}
          type="source"
          position={Position.Right}
          id={`source-${connector.path}`}
          isConnectableEnd={false}
          inactiveClass={'opacity-30'}
          {...getIsConnectable('source')}
          style={
            connector.connection === 'input'
              ? {
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: '33%',
                  left: 'unset',
                }
              : commonHandleStyle
          }
          path={connector.path}
          label={label}
          description={connector.description}
          variant="container"
        />
      )}
    </div>
  );
};

const ConnectorNodeComponent = ({
  id,
  data,
  selected,
}: NodeProps<Node<ConnectorNodeData>>) => {
  if (data.placeholder) {
    return (
      <ConnectorAddSlot
        connection={data.placeholder}
        setConnectors={data.setConnectors}
      />
    );
  }

  if (!data.connector) return null;

  return (
    <ConnectorHandleNode
      id={id}
      connector={data.connector}
      label={data.label}
      setConnectors={data.setConnectors}
      selected={selected}
    />
  );
};

export const ConnectorNode = React.memo(ConnectorNodeComponent);
