'use client';
import React, { useCallback, useMemo } from 'react';
import { ConnectorNodeData } from '../../../lib/types';
import { Node, NodeProps, Position, useConnection } from '@xyflow/react';
import { CustomHandle } from '../CustomHandle';
import { ConnectorNodeToolbar } from '../Toolbars/ConnectorNodeToolbar';

const ConnectorNodeComponent = ({
  id,
  data,
}: NodeProps<Node<ConnectorNodeData>>) => {
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
        connector={data.connector}
        setConnectors={data.setConnectors}
      />
      {data.connector.connection === 'output' && (
        <CustomHandle
          key={`target-${id}`}
          type="target"
          position={Position.Left}
          id={`target-${data.connector.path}`}
          isConnectableStart={true}
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
          isConnectableEnd={false}
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
