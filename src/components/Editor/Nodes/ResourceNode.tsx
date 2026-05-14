'use client';
import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import { Handle, ResourceNodeData } from '../../../lib/types';
import {
  Node,
  NodeProps,
  Position,
  useConnection,
  useReactFlow,
} from '@xyflow/react';
import { ResourceNodeToolbar } from '../Toolbars';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';
import { CustomHandle } from '../CustomHandle';
import { useEditorAreaContext } from '../EditorAreaContext';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import {
  buildTreeData,
  moveIntersectingNodes,
  RESOURCE_NODE_WIDTH,
} from '../../../lib/editorUtils';

const SPACE_BETWEEN_HANDLES = 30;
const MIN_RESOURCE_NODE_HEIGHT = 80;

const ResourceNodeComponent = ({
  id,
  data,
  parentId,
  selected,
}: NodeProps<Node<ResourceNodeData>>) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  useNodeDeleteShortcut(selected, () => setOpenDeleteDialog(true));
  const [handles, setHandles] = useState<Handle[]>(
    data.currentHandles || data.initialHandles,
  );
  const [heightChangedByHandles, setHeightChangedByHandles] = useState(false);
  const prevHandlesRef = useRef<Handle[]>(
    data.currentHandles || data.initialHandles,
  );
  const connection = useConnection();
  const { setNodes, resolveBlockType } = useEditorAreaContext();
  const { getIntersectingNodes, getNode } = useReactFlow();

  const resolvedSchema = useMemo(() => {
    const resolved = resolveBlockType(
      data.blockType?.apiVersion,
      data.blockType?.kind,
    );
    return resolved?.schema ?? data.blockType?.schema;
  }, [data.blockType, resolveBlockType]);

  const treeData = useMemo(
    () => (resolvedSchema ? buildTreeData(resolvedSchema) : data.treeData),
    [resolvedSchema, data.treeData],
  );

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, currentHandles: handles } }
          : node,
      ),
    );

    if (JSON.stringify(prevHandlesRef.current) !== JSON.stringify(handles)) {
      setHeightChangedByHandles(true);
    }

    prevHandlesRef.current = handles;
  }, [handles, id, setNodes]);

  const nodeHeight = useMemo(() => {
    const sourceCount = handles.filter(
      (handle) => handle.type === 'source',
    ).length;
    const targetCount = handles.filter(
      (handle) => handle.type === 'target',
    ).length;
    const maxHandlesCount = Math.max(sourceCount, targetCount);
    return Math.max(
      (maxHandlesCount + 2) * SPACE_BETWEEN_HANDLES,
      MIN_RESOURCE_NODE_HEIGHT,
    );
  }, [handles]);

  const handleLabels = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of handles) {
      const last = h.path.split('.').pop() || h.path;
      counts[last] = (counts[last] || 0) + 1;
    }
    const labels: Record<string, string> = {};
    for (const h of handles) {
      const segments = h.path.split('.');
      const last = segments[segments.length - 1] || h.path;
      if (counts[last] > 1) {
        const parent = segments[segments.length - 2];
        labels[h.path] = parent ? `${parent}.${last}` : last;
      } else {
        labels[h.path] = last;
      }
    }
    return labels;
  }, [handles]);

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === id
          ? { ...node, style: { ...node.style, height: nodeHeight } }
          : node,
      ),
    );
  }, [nodeHeight, setNodes, id]);

  useEffect(() => {
    if (!heightChangedByHandles) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const currentNode = getNode(id);
      if (currentNode) {
        const nodeRect = {
          x: currentNode.position.x,
          y: currentNode.position.y,
          width: RESOURCE_NODE_WIDTH,
          height: nodeHeight,
        };

        const intersectingNodes = getIntersectingNodes(currentNode);
        if (intersectingNodes.length > 0) {
          moveIntersectingNodes(
            currentNode,
            nodeRect,
            intersectingNodes,
            setNodes,
          );
        }
      }
      setHeightChangedByHandles(false);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    heightChangedByHandles,
    setNodes,
    id,
    getNode,
    getIntersectingNodes,
    nodeHeight,
  ]);

  const getIsConnectable = useCallback(
    (handleId: string, type: string) => {
      if (!connection?.inProgress) return { isConnectable: true };

      const isNotConnectable =
        handleId.startsWith('status') || type === 'source';

      return { isConnectable: !isNotConnectable };
    },
    [connection],
  );

  return (
    <div
      className="wrapper gradient"
      data-parent-id={parentId}
      style={{ minHeight: nodeHeight }}
    >
      <div className="inner">
        <div className="text-center align-middle border-b-[2px] border-muted-foreground/20 px-2 py-1.5 bg-muted rounded-t-lg">
          <div className="text-sm font-medium">
            {data.blockType?.title || data.label}
          </div>
          {data.blockType?.apiVersion && (
            <div className="text-[0.625rem] text-muted-foreground">
              {data.blockType.apiVersion}
            </div>
          )}
        </div>
        <ResourceNodeToolbar
          nodeId={id}
          onRequestDelete={() => setOpenDeleteDialog(true)}
          handlesStates={{
            setHandles,
            handles,
          }}
          treeData={treeData}
        />
        <div className="flex flex-row justify-between">
          <div className="flex flex-col">
            {handles
              .filter((handle) => handle.type === 'target')
              .map((targetHandle, index) => (
                <CustomHandle
                  key={targetHandle.path}
                  type="target"
                  position={Position.Left}
                  id={targetHandle.path}
                  style={{ top: `${SPACE_BETWEEN_HANDLES * (index + 2)}px` }}
                  isConnectableStart={targetHandle.path.endsWith('ref.name')}
                  connectionCount={
                    targetHandle.path.endsWith('ref.name') ? 1 : 0
                  }
                  inactiveClass={'opacity-30'}
                  description={targetHandle.description}
                  path={targetHandle.path}
                  label={handleLabels[targetHandle.path]}
                  variant="block"
                  {...getIsConnectable(targetHandle.path, 'target')}
                />
              ))}
          </div>
          <div className="flex flex-col">
            {handles
              .filter((handle) => handle.type === 'source')
              .map((sourceHandle, index) => (
                <CustomHandle
                  key={sourceHandle.path}
                  type="source"
                  position={Position.Right}
                  id={sourceHandle.path}
                  style={{ top: `${SPACE_BETWEEN_HANDLES * (index + 2)}px` }}
                  isConnectableEnd={false}
                  inactiveClass={'opacity-30'}
                  description={sourceHandle.description}
                  path={sourceHandle.path}
                  label={handleLabels[sourceHandle.path]}
                  variant="block"
                  {...getIsConnectable(sourceHandle.path, 'source')}
                />
              ))}
          </div>
        </div>
      </div>
      <NodeDeletionDialog
        open={openDeleteDialog}
        nodeId={id}
        setOpen={setOpenDeleteDialog}
      />
    </div>
  );
};

export const ResourceNode = React.memo(ResourceNodeComponent);
