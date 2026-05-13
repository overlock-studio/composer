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
import { ContainerNodeToolbar } from '../Toolbars/ContainerNodeToolbar';
import { ContainerNodeFooter } from './ContainerNodeFooter';
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
}: NodeProps<Node<ContainerNodeData>>) => {
  const [nodeHeight, setNodeHeight] = useState<number>(data.initialHeight!);
  const [nodeWidth, setNodeWidth] = useState<number>(data.initialWidth!);
  const [connectors, setConnectors] = useState<Connector[]>(data.connectors);
  const [minRequiredHeight, setMinRequiredHeight] =
    useState<number>(MIN_CONTAINER_HEIGHT);
  const [isUserResizing, setIsUserResizing] = useState<boolean>(false);
  const { nodes, setNodes, setEdges } = useEditorAreaContext();

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
            position: { x: -23, y: (index + 1) * SPACE_BETWEEN_CONNECTORS },
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
              x: nodeWidth - CONNECTOR_HEIGHT + 20,
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
                x: -23,
                y: inputCount * SPACE_BETWEEN_CONNECTORS,
              },
            };
          }
          outputCount++;
          return {
            ...updatedNode,
            position: {
              x: nodeWidth - SPACE_BETWEEN_CONNECTORS + 29,
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
      <NodeResizeControl
        minWidth={MIN_CONTAINER_WIDTH}
        minHeight={minRequiredHeight}
        onResize={(_, data) => {
          setIsUserResizing(true);
          setNodeHeight(data.height);
          setNodeWidth(data.width);
        }}
      />
      <div
        className="wrapper gradient"
        data-parent-id={containerId}
        style={{ width: '100%', height: '100%' }}
      >
        <div className="inner relative">
          <div className="text-center align-middle border-b-[2px] border-muted-foreground/20 px-2 py-1.5 bg-muted rounded-t-lg">
            <div className="text-[0.7em]">{name}</div>
            {apiVersion && (
              <div className="text-[0.625rem] text-muted-foreground">
                {apiVersion}
              </div>
            )}
          </div>
          <ContainerNodeToolbar
            setConnectors={setConnectors}
            id={containerId}
            name={name}
            onNameChange={handleNameChange}
            kind={kind}
            apiVersion={apiVersion}
            onKindChange={handleKindChange}
            onApiVersionChange={handleApiVersionChange}
          />
          <ContainerNodeFooter functions={functions} />
        </div>
      </div>
    </>
  );
};

export const ContainerNode = React.memo(ContainerNodeComponent);
