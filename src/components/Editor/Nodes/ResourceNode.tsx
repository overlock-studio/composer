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
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { Box, Plus, Trash2 } from 'lucide-react';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';
import { CustomHandle } from '../CustomHandle';
import { useEditorActions } from '../EditorAreaContext';
import { useDraggedHandleType } from '../../../lib/useDraggedHandleType';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import { Button } from '../../ui/button';
import { EditHandlesMenu } from '../Menus';
import { RowTree } from '../RowTree';
import { connectorGroupId } from '../../../lib/containerGraph';
import type { ConnectorGroupNodeData } from '../../../lib/types';
import {
  buildTreeData,
  moveIntersectingNodes,
  pathRows,
  resourceNodeHeight,
  RESOURCE_NODE_WIDTH,
  RESOURCE_ROW_HEIGHT as SPACE_BETWEEN_HANDLES,
} from '../../../lib/editorUtils';

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
  const draggedFrom = useDraggedHandleType();
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

  // With Status on the left of the blocks, outputs join the inputs on the
  // left edge, listed under them, so every edge meets the block on one side.
  const outputsLeft = useStore(
    (s) =>
      (
        s.nodeLookup.get(connectorGroupId('output'))?.data as
          ConnectorGroupNodeData | undefined
      )?.side === 'left',
  );
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outputsLeft, updateNodeInternals]);

  const nodeHeight = useMemo(
    () => resourceNodeHeight(handles, outputsLeft),
    [handles, outputsLeft],
  );

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

  // While an edge is being drawn only the other end's type can take it, and a
  // status field is never written to.
  const getIsConnectable = useCallback(
    (handleId: string, type: string) => {
      if (!draggedFrom) return { isConnectable: true };

      const isNotConnectable =
        type === draggedFrom ||
        (type === 'target' && handleId.startsWith('status'));

      return { isConnectable: !isNotConnectable };
    },
    [draggedFrom],
  );

  // An output row on the right edge reads towards it, mirrored; on the left
  // edge it continues the inputs' column, below them.
  const sourceRow = (row: (typeof sourceRows)[number], index: number) => (
    <CustomHandle
      key={row.path}
      type="source"
      position={outputsLeft ? Position.Left : Position.Right}
      id={row.path}
      style={{
        top: `${SPACE_BETWEEN_HANDLES * ((outputsLeft ? targetRows.length : 0) + index + 2)}px`,
      }}
      inactiveClass={'opacity-30'}
      description={row.item?.description ?? ''}
      path={row.path}
      label={
        outputsLeft ? (
          <>
            <RowTree row={row} height={SPACE_BETWEEN_HANDLES} />
            <span className="min-w-0 truncate">{row.name}</span>
          </>
        ) : (
          <>
            <span className="min-w-0 truncate">{row.name}</span>
            <RowTree row={row} height={SPACE_BETWEEN_HANDLES} mirrored />
          </>
        )
      }
      labelClassName={outputsLeft ? TARGET_ROW : SOURCE_ROW}
      variant="block"
      {...getIsConnectable(row.path, 'source')}
    />
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
        <div className={`flex ${outputsLeft ? 'w-full' : 'w-1/2'} flex-col`}>
          {targetRows.map((row, index) => (
            <CustomHandle
              key={row.path}
              type="target"
              position={Position.Left}
              id={row.path}
              style={{ top: `${SPACE_BETWEEN_HANDLES * (index + 2)}px` }}
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
          {outputsLeft && sourceRows.map((row, index) => sourceRow(row, index))}
        </div>
        {!outputsLeft && (
          <div className="flex w-1/2 flex-col">
            {sourceRows.map((row, index) => sourceRow(row, index))}
          </div>
        )}
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
