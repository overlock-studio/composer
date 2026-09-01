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
import { Box, Plus, Trash2 } from 'lucide-react';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';
import { CustomHandle } from '../CustomHandle';
import { useEditorActions } from '../EditorAreaContext';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import { Button } from '../../ui/button';
import { EditHandlesMenu } from '../Menus';
import { RowTree } from '../RowTree';
import {
  buildTreeData,
  moveIntersectingNodes,
  pathRows,
  RESOURCE_NODE_WIDTH,
} from '../../../lib/editorUtils';

const SPACE_BETWEEN_HANDLES = 30;
const MIN_RESOURCE_NODE_HEIGHT = 80;

// The two columns split the node between them, each reading outwards towards
// its own handles: targets left to right, sources right-aligned. The column
// owns the half, so a row fills it and long names truncate inside it rather
// than running into the other side.
const TARGET_ROW = 'flex w-full items-center justify-start pl-[10px] pr-1';
const SOURCE_ROW = 'flex w-full items-center justify-end pr-[10px] pl-1';

const ResourceNodeComponent = ({
  id,
  data,
  parentId,
  selected,
}: NodeProps<Node<ResourceNodeData>>) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  useNodeDeleteShortcut(selected, () => setOpenDeleteDialog(true));
  const [handles, setHandles] = useState<Handle[]>(
    data.currentHandles || data.initialHandles,
  );
  const [heightChangedByHandles, setHeightChangedByHandles] = useState(false);
  const prevHandlesRef = useRef<Handle[]>(
    data.currentHandles || data.initialHandles,
  );
  const connection = useConnection();
  const { setNodes, resolveBlockType } = useEditorActions();
  const { getIntersectingNodes, getNode } = useReactFlow();

  const resolvedBlockType = useMemo(
    () => resolveBlockType(data.blockType?.apiVersion, data.blockType?.kind),
    [data.blockType, resolveBlockType],
  );
  const resolvedSchema = resolvedBlockType?.schema ?? data.blockType?.schema;
  const icon = resolvedBlockType?.icon ?? data.blockType?.icon;

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

  // Each side of the block is its own tree, so the two columns are built and
  // measured apart. Branch rows are rows like any other, which is why the
  // height follows them rather than the handle count.
  const targetRows = useMemo(
    () => pathRows(handles.filter((handle) => handle.type === 'target')),
    [handles],
  );
  const sourceRows = useMemo(
    () => pathRows(handles.filter((handle) => handle.type === 'source')),
    [handles],
  );

  const nodeHeight = useMemo(() => {
    const maxRowCount = Math.max(targetRows.length, sourceRows.length);
    return Math.max(
      (maxRowCount + 2) * SPACE_BETWEEN_HANDLES,
      MIN_RESOURCE_NODE_HEIGHT,
    );
  }, [targetRows, sourceRows]);

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
      className="node-body"
      data-parent-id={parentId}
      style={{ minHeight: nodeHeight }}
    >
      <div className="flex items-center border-b-[2px] border-muted-foreground/20 px-2 py-1 rounded-t-lg">
        <div className="w-14 flex items-center">
          {icon ? (
            <img
              src={icon}
              alt=""
              width={20}
              height={20}
              draggable={false}
            />
          ) : (
            <Box
              className="text-muted-foreground"
              width={20}
              height={20}
            />
          )}
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm font-medium">
            {data.blockType?.title || data.label}
          </div>
          {data.blockType?.apiVersion && (
            <div className="text-[0.625rem] text-muted-foreground">
              {data.blockType.apiVersion}
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3.5"
            onClick={() => setEditOpen(true)}
          >
            <Plus />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 [&_svg]:size-3.5 hover:text-red-400"
            onClick={() => setOpenDeleteDialog(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <EditHandlesMenu
        nodeId={id}
        handlesStates={{ setHandles, handles }}
        treeData={treeData}
        open={editOpen}
        setMenuOpen={setEditOpen}
      />
      <div className="flex flex-row justify-between">
        <div className="flex w-1/2 flex-col">
          {targetRows.map((row, index) => (
            <CustomHandle
              key={row.path}
              type="target"
              position={Position.Left}
              id={row.path}
              style={{ top: `${SPACE_BETWEEN_HANDLES * (index + 2)}px` }}
              isConnectableStart={row.path.endsWith('ref.name')}
              connectionCount={row.path.endsWith('ref.name') ? 1 : 0}
              inactiveClass={'opacity-30'}
              description={row.item?.description ?? ''}
              path={row.path}
              label={
                <>
                  <RowTree row={row} height={SPACE_BETWEEN_HANDLES} />
                  <span className="min-w-0 truncate">{row.name}</span>
                </>
              }
              labelClassName={TARGET_ROW}
              variant="block"
              {...getIsConnectable(row.path, 'target')}
            />
          ))}
        </div>
        <div className="flex w-1/2 flex-col">
          {sourceRows.map((row, index) => (
            <CustomHandle
              key={row.path}
              type="source"
              position={Position.Right}
              id={row.path}
              style={{ top: `${SPACE_BETWEEN_HANDLES * (index + 2)}px` }}
              isConnectableEnd={false}
              inactiveClass={'opacity-30'}
              description={row.item?.description ?? ''}
              path={row.path}
              label={
                <>
                  <span className="min-w-0 truncate">{row.name}</span>
                  <RowTree row={row} height={SPACE_BETWEEN_HANDLES} mirrored />
                </>
              }
              labelClassName={SOURCE_ROW}
              variant="block"
              {...getIsConnectable(row.path, 'source')}
            />
          ))}
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
