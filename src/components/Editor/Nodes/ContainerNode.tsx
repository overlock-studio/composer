'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ConnectorNodeData, ContainerNodeData } from '../../../lib/types';
import {
  addEdge,
  Node,
  NodeProps,
  useNodesInitialized,
  NodeResizeControl,
  useStoreApi,
  useReactFlow,
  type NodeDimensionChange,
} from '@xyflow/react';
import { Box, Pencil, Plus, Trash2 } from 'lucide-react';
import { NodeDeletionDialog } from '../ConfirmDeletionDialog';
import { useNodeDeleteShortcut } from '../../../lib/useNodeDeleteShortcut';
import { ContainerNodeFooter } from './ContainerNodeFooter';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { EditConnectorsMenu } from '../Menus';
import {
  buildTreeData,
  getHandleByPath,
  getHandlesFromSchema,
  RESOURCE_NODE_WIDTH,
  MIN_CONTAINER_WIDTH,
  MIN_CONTAINER_HEIGHT,
  connectorToHandle,
  moveIntersectingNodes,
} from '../../../lib/editorUtils';
import { useEditorAreaContext } from '../EditorAreaContext/EditorAreaContext';
import { Connector } from '../../../api/types';

const SPACE_BETWEEN_CONNECTORS = 52.5;
const CONNECTOR_HEIGHT = 50;

const ContainerNodeComponent = ({
  id: containerId,
  data,
  selected,
}: NodeProps<Node<ContainerNodeData>>) => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  useNodeDeleteShortcut(selected, () => setOpenDeleteDialog(true));
  const [nodeHeight, setNodeHeight] = useState<number>(data.initialHeight!);
  const [nodeWidth, setNodeWidth] = useState<number>(data.initialWidth!);
  const [connectors, setConnectors] = useState<Connector[]>(data.connectors);
  const [minRequiredHeight, setMinRequiredHeight] =
    useState<number>(MIN_CONTAINER_HEIGHT);
  const [isUserResizing, setIsUserResizing] = useState<boolean>(false);
  const { nodes, setNodes, setEdges, resolveBlockType } =
    useEditorAreaContext();

  const connectorLabels = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of connectors || []) {
      const last = c.path.split('.').pop() || c.path;
      counts[last] = (counts[last] || 0) + 1;
    }
    const labels: Record<string, string> = {};
    for (const c of connectors || []) {
      const segments = c.path.split('.');
      const last = segments[segments.length - 1] || c.path;
      if (counts[last] > 1) {
        const parent = segments[segments.length - 2];
        labels[c.path] = parent ? `${parent}.${last}` : last;
      } else {
        labels[c.path] = last;
      }
    }
    return labels;
  }, [connectors]);
  const nodesInitialized = useNodesInitialized({
    includeHiddenNodes: false,
  });
  const store = useStoreApi();
  const { getIntersectingNodes, getNode } = useReactFlow();

  const { childBlocks, name, reactFlowRef, blockType, functions } = data;
  const kind = data.kind ?? blockType?.kind ?? '';
  const apiVersion = data.apiVersion ?? blockType?.apiVersion ?? '';
  const resolvedBlockType = useMemo(
    () => resolveBlockType(apiVersion, kind),
    [apiVersion, kind, resolveBlockType],
  );
  const icon = resolvedBlockType?.icon ?? blockType?.icon;

  const handleNameChange = (newName: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === containerId
          ? { ...node, data: { ...node.data, name: newName } }
          : node,
      ),
    );
  };

  const handleKindChange = (newKind: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === containerId
          ? { ...node, data: { ...node.data, kind: newKind } }
          : node,
      ),
    );
  };

  const handleApiVersionChange = (newApiVersion: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === containerId
          ? { ...node, data: { ...node.data, apiVersion: newApiVersion } }
          : node,
      ),
    );
  };

  const [editName, setEditName] = useState<string>('');
  const [editKind, setEditKind] = useState<string>('');
  const [editApiVersion, setEditApiVersion] = useState<string>('');

  const openEditDialog = () => {
    setEditName(name || '');
    setEditKind(kind || '');
    setEditApiVersion(apiVersion || '');
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (editName.trim() && editName !== name) {
      handleNameChange(editName.trim());
    }
    if (editKind.trim() !== kind) {
      handleKindChange(editKind.trim());
    }
    if (editApiVersion.trim() !== apiVersion) {
      handleApiVersionChange(editApiVersion.trim());
    }
    setEditOpen(false);
  };

  const checkAndMoveIntersectingNodes = useCallback(
    (width: number, height: number) => {
      const currentNode = getNode(containerId);
      if (currentNode) {
        const nodeRect = {
          x: currentNode.position.x,
          y: currentNode.position.y,
          width,
          height,
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
    },
    [getNode, containerId, getIntersectingNodes, setNodes],
  );

  /* eslint-disable */
  useEffect(() => {
    if (nodesInitialized) {
      const inputConnectors = [];
      const outputConnectors = [];

      connectors?.forEach((conn) => {
        if (conn.connection !== 'output') {
          inputConnectors.push(conn);
        } else {
          outputConnectors.push(conn);
        }
      });

      const maxConnectorsCount = Math.max(
        inputConnectors.length,
        outputConnectors.length,
      );
      const calculatedHeight =
        (maxConnectorsCount + 1) * SPACE_BETWEEN_CONNECTORS +
        CONNECTOR_HEIGHT / 2;

      const requiredHeight = Math.max(calculatedHeight, MIN_CONTAINER_HEIGHT);
      setMinRequiredHeight(requiredHeight);

      if (calculatedHeight > nodeHeight) {
        setNodeHeight(calculatedHeight);
        setIsUserResizing(true);
      }
    }
  }, [
    nodesInitialized,
    connectors,
    containerId,
    checkAndMoveIntersectingNodes,
  ]);

  useEffect(() => {
    const { triggerNodeChanges } = store.getState();

    const resizingChange: NodeDimensionChange = {
      id: containerId,
      type: 'dimensions',
      resizing: true,
      setAttributes: true,
      dimensions: {
        width: nodeWidth,
        height: nodeHeight,
      },
    };

    const finalChange: NodeDimensionChange = {
      id: containerId,
      type: 'dimensions',
      resizing: false,
      dimensions: {
        width: nodeWidth,
        height: nodeHeight,
      },
    };

    triggerNodeChanges([resizingChange, finalChange]);

    if (isUserResizing) {
      queueMicrotask(() => {
        checkAndMoveIntersectingNodes(nodeWidth, nodeHeight);
        setIsUserResizing(false);
      });
    }
  }, [
    nodeHeight,
    nodeWidth,
    containerId,
    store,
    checkAndMoveIntersectingNodes,
    isUserResizing,
  ]);

  useEffect(() => {
    const connectorNodeIds =
      connectors?.map((conn) => `${containerId}-${conn.path}`) || [];

    setNodes((nds) => {
      const filteredNodes = nds.filter(
        (node) =>
          !(
            node.parentId === containerId &&
            node.type === 'connector' &&
            !connectorNodeIds.includes(node.id)
          ),
      );

      const inputConnectors: Connector[] = [];
      const outputConnectors: Connector[] = [];

      connectors?.forEach((conn) => {
        if (conn.connection !== 'output') {
          inputConnectors.push(conn);
        } else {
          outputConnectors.push(conn);
        }
      });

      const newNodes: Node[] = [];

      inputConnectors.forEach((connector, index) => {
        const connectorNodeId = `${containerId}-${connector.path}`;
        if (!filteredNodes.some((n) => n.id === connectorNodeId)) {
          newNodes.push({
            id: connectorNodeId,
            type: 'connector',
            position: { x: -25, y: (index + 1) * SPACE_BETWEEN_CONNECTORS },
            parentId: containerId,
            draggable: false,
            data: { connector, setConnectors, label: connectorLabels[connector.path] },
          });
        }
      });

      outputConnectors.forEach((connector, index) => {
        const connectorNodeId = `${containerId}-${connector.path}`;
        if (!filteredNodes.some((n) => n.id === connectorNodeId)) {
          newNodes.push({
            id: connectorNodeId,
            type: 'connector',
            position: {
              x: nodeWidth - CONNECTOR_HEIGHT + 22,
              y: (index + 1) * SPACE_BETWEEN_CONNECTORS,
            },
            parentId: containerId,
            draggable: false,
            data: { connector, setConnectors, label: connectorLabels[connector.path] },
          });
        }
      });

      return [...filteredNodes, ...newNodes];
    });
  }, [connectors, containerId, nodeWidth, connectorLabels]);

  useEffect(() => {
    setNodes((nds) => {
      let inputCount = 0;
      let outputCount = 0;

      return nds.map((node) => {
        if (node.parentId === containerId && node.type === 'connector') {
          const currentNode = node as Node<ConnectorNodeData>;
          const currentConnector = currentNode.data.connector;
          const updatedConnector = connectors.find(
            (c) => c.path === currentConnector.path,
          );

          const updatedNode: Node<ConnectorNodeData> = {
            ...currentNode,
            data: {
              ...currentNode.data,
              connector: updatedConnector
                ? updatedConnector
                : currentNode.data.connector,
              label: connectorLabels[currentConnector.path],
            },
          };

          if (updatedNode.data.connector.connection !== 'output') {
            inputCount++;
            return {
              ...updatedNode,
              position: {
                x: -25,
                y: inputCount * SPACE_BETWEEN_CONNECTORS,
              },
            };
          }
          outputCount++;
          return {
            ...updatedNode,
            position: {
              x: nodeWidth - SPACE_BETWEEN_CONNECTORS + 31,
              y: outputCount * SPACE_BETWEEN_CONNECTORS,
            },
          };
        }
        return node;
      });
    });
  }, [containerId, connectors, nodeWidth, connectorLabels]);

  useEffect(() => {
    const newConnectors = [...(connectors || [])];

    childBlocks.forEach((block) => {
      const {
        id: childBlockId,
        blockType,
        parentId,
        edges: apiEdges,
        connectors: savedConnectors,
      } = block;

      if (!blockType || !blockType.schema) return;

      const nodeExists = nodes.some((node) => node.id === childBlockId);

      if (nodeExists) return;

      let initialHandles =
        savedConnectors && savedConnectors.length > 0
          ? savedConnectors.map(connectorToHandle)
          : getHandlesFromSchema({ schema: blockType.schema });

      const treeData = buildTreeData(blockType.schema);

      apiEdges?.forEach((edge) => {
        if (edge.sourceHandle) {
          if (
            edge.source === childBlockId &&
            !initialHandles.some((handle) => edge.sourceHandle == handle.path)
          ) {
            const handleByPath = getHandleByPath(
              blockType.schema,
              edge.sourceHandle,
            );
            if (handleByPath) {
              initialHandles.push(handleByPath);
            } else {
              initialHandles.push({
                path: edge.sourceHandle,
                description: '',
                type: 'source',
              });
            }
          }
        }
        if (edge.targetHandle) {
          if (
            edge.target === childBlockId &&
            !initialHandles.some((handle) => edge.targetHandle == handle.path)
          ) {
            const handleByPath = getHandleByPath(
              blockType.schema,
              edge.targetHandle,
            );
            if (handleByPath) {
              initialHandles.push(handleByPath);
            } else {
              initialHandles.push({
                path: edge.targetHandle,
                description: '',
                type: 'target',
              });
            }
          }
        }
      });

      if (newConnectors && newConnectors.length > (connectors?.length || 0)) {
        setConnectors(Array.from(newConnectors));
      }

      setNodes((prev) => {
        if (prev.some((node) => node.id === childBlockId)) {
          return prev;
        } else {
          return [
            ...prev,
            {
              id: childBlockId,
              type: 'resource',
              position: block.position || {
                x: 50,
                y: 50,
              },
              extent: 'parent',
              parentId,
              style: { width: RESOURCE_NODE_WIDTH },
              draggable: true,
              data: {
                label: childBlockId,
                initialHandles,
                currentHandles:
                  savedConnectors && savedConnectors.length > 0
                    ? savedConnectors.map(connectorToHandle)
                    : undefined,
                treeData,
                apiEdges,
                blockType,
              },
            },
          ];
        }
      });

      apiEdges.forEach((edge) => {
        if (edge.targetHandle && edge.sourceHandle) {
          const sourceHandle = edge.sourceHandle;
          const targetHandle = edge.targetHandle;

          setEdges((eds) => {
            // Check if already in ReactFlow format (source is connector node ID)
            const isSourceConnector = edge.source.startsWith(`${parentId}-`);
            const isTargetConnector = edge.target.startsWith(`${parentId}-`);

            if (isSourceConnector || isTargetConnector) {
              // Already in ReactFlow format, use as-is
              return addEdge(
                {
                  type: 'customEdge',
                  source: edge.source,
                  sourceHandle: sourceHandle,
                  target: edge.target,
                  targetHandle: targetHandle,
                  data: {
                    transformers: edge.transformers,
                    reactFlowRef: reactFlowRef,
                  },
                },
                eds,
              );
            }

            if (
              parentId === edge.source &&
              initialHandles.some((handle) => targetHandle == handle.path)
            ) {
              // FromCompositeFieldPath: connector node -> resource node (import format)
              return addEdge(
                {
                  type: 'customEdge',
                  source: `${parentId}-${sourceHandle}`,
                  sourceHandle: `source-${sourceHandle}`,
                  target: edge.target,
                  targetHandle: targetHandle,
                  data: {
                    transformers: edge.transformers,
                    reactFlowRef: reactFlowRef,
                  },
                },
                eds,
              );
            } else if (
              parentId === edge.target &&
              initialHandles.some((handle) => sourceHandle == handle.path)
            ) {
              // ToCompositeFieldPath: resource node -> connector node (import format)
              return addEdge(
                {
                  type: 'customEdge',
                  source: edge.source,
                  sourceHandle: sourceHandle,
                  target: `${parentId}-${targetHandle}`,
                  targetHandle: `target-${targetHandle}`,
                  data: {
                    transformers: edge.transformers,
                    reactFlowRef: reactFlowRef,
                  },
                },
                eds,
              );
            }
            return eds;
          });
        }
      });
    });
  }, [childBlocks]);

  return (
    <>
      <div
        className="node-body relative"
        data-parent-id={containerId}
        style={{ width: '100%', height: '100%' }}
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
            <div className="text-sm font-medium">{name}</div>
            {apiVersion && (
              <div className="text-[0.625rem] text-muted-foreground">
                {apiVersion}
              </div>
            )}
          </div>
          <div className="flex gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 [&_svg]:size-3.5"
              onClick={() => setAddOpen(true)}
            >
              <Plus />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 [&_svg]:size-3.5"
              onClick={openEditDialog}
            >
              <Pencil />
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
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Connector</DialogTitle>
            </DialogHeader>
            <EditConnectorsMenu
              setOpen={setAddOpen}
              setConnectors={setConnectors}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Composition</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Composition Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter composition name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Kind</label>
                <Input
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value)}
                  placeholder="Enter kind (e.g. XMyResource)"
                />
              </div>
              <div>
                <label className="text-sm font-medium">API Version</label>
                <Input
                  value={editApiVersion}
                  onChange={(e) => setEditApiVersion(e.target.value)}
                  placeholder="Enter API version (e.g. example.org/v1alpha1)"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditSave}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <ContainerNodeFooter functions={functions} />
      </div>
      <NodeResizeControl
        minWidth={MIN_CONTAINER_WIDTH}
        minHeight={minRequiredHeight}
        onResize={(_, data) => {
          setIsUserResizing(true);
          setNodeHeight(data.height);
          setNodeWidth(data.width);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
          translate: '-20px -20px',
          zIndex: 10,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          xmlns="http://www.w3.org/2000/svg"
          className="text-muted-foreground/70"
          style={{ display: 'block', pointerEvents: 'none' }}
        >
          <path
            d="M10 16 L16 10 M13 16 L16 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </NodeResizeControl>
      <NodeDeletionDialog
        open={openDeleteDialog}
        nodeId={containerId}
        setOpen={setOpenDeleteDialog}
      />
    </>
  );
};

export const ContainerNode = React.memo(ContainerNodeComponent);
