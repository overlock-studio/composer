'use client';
import React, { useCallback, useState } from 'react';
import { ConnectorNodeData } from '../../../lib/types';
import { Node, NodeProps, Position } from '@xyflow/react';
import { CustomHandle } from '../CustomHandle';
import { ConnectorNodeToolbar } from '../Toolbars/ConnectorNodeToolbar';
import { ConnectorNodeDeletionDialog } from '../ConfirmDeletionDialog';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import { useDraggedHandleType } from '../../../lib/useDraggedHandleType';

const ConnectorNodeComponent = ({
  id,
  data,
  selected,
}: NodeProps<Node<ConnectorNodeData>>) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  useNodeDeleteShortcut(selected, () => setOpenDeleteDialog(true));
  const draggedFrom = useDraggedHandleType();

  // While an edge is being drawn only the other end's type can take it.
  const getIsConnectable = useCallback(
    (type: string) => ({ isConnectable: type !== draggedFrom }),
    [draggedFrom],
  );

  const commonHandleStyle = { top: '50%', transform: 'translateY(-50%)' };

  return (
    <div className="connector-no-glow">
      <ConnectorNodeToolbar
        connector={data.connector}
        setConnectors={data.setConnectors}
        onRequestDelete={() => setOpenDeleteDialog(true)}
      />
      <ConnectorNodeDeletionDialog
        open={openDeleteDialog}
        nodeId={data.connector.path}
        setOpen={setOpenDeleteDialog}
        setConnectors={data.setConnectors}
      />
      {data.connector.connection === 'output' && (
        <CustomHandle
          key={`target-${id}`}
          type="target"
          position={Position.Left}
          id={`target-${data.connector.path}`}
          inactiveClass={'opacity-30'}
          {...getIsConnectable('target')}
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            left: '32%',
            right: 'unset',
          }}
          path={data.connector.path}
          label={data.label}
          description={data.connector.description}
          variant="container"
        />
      )}
      {data.connector.connection !== 'output' && (
        <CustomHandle
          key={`source-${id}`}
          type="source"
          position={Position.Right}
          id={`source-${data.connector.path}`}
          inactiveClass={'opacity-30'}
          {...getIsConnectable('source')}
          style={
            data.connector.connection === 'input'
              ? {
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: '33%',
                  left: 'unset',
                }
              : commonHandleStyle
          }
          path={data.connector.path}
          label={data.label}
          description={data.connector.description}
          variant="container"
        />
      )}
    </div>
  );
};

export const ConnectorNode = React.memo(ConnectorNodeComponent);
