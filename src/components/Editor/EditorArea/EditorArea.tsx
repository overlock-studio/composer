'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  Controls,
  useReactFlow,
  Background,
  Connection,
  Edge,
  Node,
  useNodesInitialized,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEditorAreaContext } from '../EditorAreaContext';
import {
  buildTreeData,
  EDGE_TYPES,
  NODE_TYPES,
  CONTAINER_NODE_WIDTH,
  RESOURCE_NODE_WIDTH,
  resolveNodeCollisions,
} from '../../../lib/editorUtils';
import {
  buildConnectorNodes,
  buildContainerGraph,
  connectorHandleId,
  isConnectorGroupId,
  mergeContainerIntoNodes,
} from '../../../lib/containerGraph';
import { useToast } from '../../../hooks/use-toast';
import { Spinner } from '../../Spinner';
import { Block, Connector } from '../../../api/types';
import logger from '../../../lib/logger';

const useDocumentColorMode = (): 'light' | 'dark' => {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light',
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const update = (): void =>
      setMode(root.classList.contains('dark') ? 'dark' : 'light');
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return mode;
};

const sanitizeBaseName = (s: string): string =>
  s.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'block';

const nextUniqueNodeName = (
  existingNodes: { id: string }[],
  blockType: { kind?: string; name?: string },
): string => {
  const base = sanitizeBaseName(blockType.kind || blockType.name || 'block');
  const ids = new Set(existingNodes.map((n) => n.id));
  let counter = 1;
  while (ids.has(`${base}${counter}`)) counter++;
  return `${base}${counter}`;
};

export const EditorArea = () => {
  const reactFlowRef = useRef<HTMLDivElement | null>(null);
  const colorMode = useDocumentColorMode();
  const {
    selectedBlockType,
    nodes,
    onNodesChange,
    setNodes,
    edges,
    setEdges,
    blocks,
    setBlocks,
    onEdgesChange,
    blocksLoading,
    setBlocksLoading,
    adapter,
    entityRef,
    editorMode,
    activeContainerId,
    containerSession,
  } = useEditorAreaContext();
  const { screenToFlowPosition, fitView, getViewport, setViewport } =
    useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const { entity, entityId } = entityRef;
  const { toast } = useToast();
  const [hasInitialFitView, setHasInitialFitView] = useState(false);
  // Connectors of the container currently open, tagged with whose they are so
  // the nodes built from them are never mixed up across containers.
  const [openConnectors, setOpenConnectors] = useState<{
    containerId: string;
    connectors: Connector[];
  } | null>(null);

  const setContainerConnectors = useCallback<
    React.Dispatch<React.SetStateAction<Connector[]>>
  >((update) => {
    setOpenConnectors((prev) =>
      prev
        ? {
            ...prev,
            connectors:
              typeof update === 'function' ? update(prev.connectors) : update,
          }
        : prev,
    );
  }, []);

  const fetchBlocks = async () => {
    setEdges([]);
    setNodes([]);
    setHasInitialFitView(false);
    setBlocksLoading(true);

    if (!entityId) {
      setBlocksLoading(false);
      return;
    }

    let blocks: Block[] = [];

    try {
      if (entity === 'configuration') {
        blocks = await adapter.getBlocks({ configurationId: entityId });
      } else if (entity === 'template') {
        const template = await adapter.getTemplate(entityId);
        if (!template) {
          throw new Error('Template not found');
        }
        blocks = (template.blocks as Block[]) || [];
      }

      setBlocks(blocks);
    } catch (e) {
      logger.info(e);

      toast({
        title: `Unable to retrieve data for this ${entity}`,
        description: `${e}`,
        variant: 'destructive',
      });
    } finally {
      setBlocksLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, [entity, entityId]);

  const createNodesFromBlocks = useCallback(() => {
    if (!blocks) return;
    // The container canvas is not what is on screen while a container is open.
    if (activeContainerId) return;

    const containerNodes = blocks.filter((block) => block.parentId === '');
    const newNodes: Node[] = [];

    // Track horizontal offset for positioning multiple compositions
    let horizontalOffset = 0;
    const COMPOSITION_SPACING = 200;

    containerNodes.forEach((container) => {
      const { blockType, id, connectors, name, position } = container;
      // Extract kind and apiVersion from block (set by CompositionService) or fallback to blockType
      const kind = (container as any).kind ?? blockType?.kind;
      const apiVersion = (container as any).apiVersion ?? blockType?.apiVersion;

      if (nodes.some((node) => node.id === id)) return;

      const childBlocks = blocks.filter((block) => block.parentId === id);

      // Use saved position if exists and is not default (0,0), otherwise position horizontally
      const hasCustomPosition =
        position && (position.x !== 0 || position.y !== 0);
      const nodePosition = hasCustomPosition
        ? position
        : { x: horizontalOffset, y: 0 };

      // Update offset for next composition
      if (!hasCustomPosition) {
        horizontalOffset += CONTAINER_NODE_WIDTH + COMPOSITION_SPACING;
      }

      const nodeData: any = {
        id,
        position: nodePosition,
        type: 'container',
        style: { width: CONTAINER_NODE_WIDTH },
        data: {
          name: name || id,
          connectors,
          childBlocks,
          reactFlowRef,
          blockType,
          kind,
          apiVersion,
          functions: container.functions || [],
        },
      };

      newNodes.push(nodeData);
    });

    if (newNodes.length) {
      setNodes((prev) => [...prev, ...newNodes]);
    }
  }, [blocks, setNodes, activeContainerId]);

  useEffect(() => {
    createNodesFromBlocks();
  }, [createNodesFromBlocks, blocks]);

  useEffect(() => {
    if (
      nodesInitialized &&
      !hasInitialFitView &&
      !blocksLoading &&
      nodes.length > 0
    ) {
      fitView({
        maxZoom: 0.75,
        duration: 300,
      });
      setHasInitialFitView(true);
    }
  }, [
    nodesInitialized,
    fitView,
    hasInitialFitView,
    blocksLoading,
    nodes.length,
  ]);

  // Opening a container parks the container-level graph and swaps in the
  // blocks of that container; closing it folds the blocks back and restores
  // what was on screen before.
  const openedContainerId = useRef<string | null>(null);
  useEffect(() => {
    const previous = openedContainerId.current;
    if (previous === activeContainerId) return;
    openedContainerId.current = activeContainerId;

    if (activeContainerId) {
      const container = nodes.find((node) => node.id === activeContainerId);
      if (!container) return;
      const connectors =
        (container.data as { connectors?: Connector[] }).connectors ?? [];
      containerSession.current = {
        containerId: activeContainerId,
        nodes,
        edges,
        viewport: getViewport(),
        connectors,
      };
      const graph = buildContainerGraph(
        container,
        reactFlowRef,
        setContainerConnectors,
      );
      setOpenConnectors({ containerId: activeContainerId, connectors });
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setHasInitialFitView(false);
      return;
    }

    const parked = containerSession.current;
    containerSession.current = null;
    setOpenConnectors(null);
    if (!parked || !previous) return;

    setNodes(
      mergeContainerIntoNodes(
        parked.nodes,
        previous,
        nodes,
        edges,
        parked.connectors,
      ),
    );
    setEdges(parked.edges);
    setViewport(parked.viewport);
  }, [
    activeContainerId,
    nodes,
    edges,
    containerSession,
    setNodes,
    setEdges,
    setContainerConnectors,
    getViewport,
    setViewport,
  ]);

  // Editing the connector set refills the two connector nodes and drops the
  // edges of connectors that are gone. Both nodes keep wherever they were
  // dragged to, and the blocks are left alone.
  useEffect(() => {
    if (!activeContainerId || openConnectors?.containerId !== activeContainerId)
      return;
    const { connectors } = openConnectors;
    if (containerSession.current) {
      containerSession.current.connectors = connectors;
    }

    setNodes((prev) => [
      ...prev.filter((node) => node.type !== 'connectorGroup'),
      ...buildConnectorNodes(
        connectors,
        setContainerConnectors,
        prev.filter((node) => node.type === 'resource'),
        prev.filter((node) => node.type === 'connectorGroup'),
      ),
    ]);

    const live = new Set(connectors.map(connectorHandleId));
    setEdges((prev) =>
      prev.filter(
        (edge) =>
          !(
            isConnectorGroupId(edge.source) &&
            !live.has(edge.sourceHandle ?? '')
          ) &&
          !(
            isConnectorGroupId(edge.target) &&
            !live.has(edge.targetHandle ?? '')
          ),
      ),
    );
  }, [
    activeContainerId,
    openConnectors,
    containerSession,
    setNodes,
    setEdges,
    setContainerConnectors,
  ]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, type: 'customEdge', data: { reactFlowRef } }, eds),
      );
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const performDrop = useCallback(
    (opts: {
      clientX: number;
      clientY: number;
      target: EventTarget | null;
    }) => {
      if (!selectedBlockType) return;
      const { clientX, clientY } = opts;

      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const id = nextUniqueNodeName(nodes, selectedBlockType);
      let newNode: Node | null = null;

      // Each canvas takes its own kind of block: containers at the container
      // level, provider blocks inside a container.
      if (editorMode === 'container') {
        if (!selectedBlockType.leaf) return;
        newNode = {
          id,
          position,
          type: 'resource',
          style: { width: RESOURCE_NODE_WIDTH },
          draggable: true,
          data: {
            label: id,
            name: id,
            treeData: buildTreeData(selectedBlockType.schema),
            initialHandles: [],
            blockType: selectedBlockType,
          },
        };
      } else {
        if (selectedBlockType.leaf) {
          toast({
            title: 'Blocks belong inside a container',
            description: 'Open a container to add provider blocks to it.',
          });
          return;
        }

        newNode = {
          id,
          position,
          type: 'container',
          style: { width: CONTAINER_NODE_WIDTH },
          data: {
            name: id,
            connectors: [],
            childBlocks: [],
            reactFlowRef,
            blockType: selectedBlockType,
            kind: selectedBlockType.kind,
            apiVersion: selectedBlockType.apiVersion,
          },
        };
      }
      if (newNode) {
        setNodes((nds) => nds.concat(newNode));
      }
    },
    [
      selectedBlockType,
      nodes,
      screenToFlowPosition,
      setNodes,
      toast,
      editorMode,
    ],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    performDrop({
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
    });
  };

  const performDropRef = useRef(performDrop);
  useEffect(() => {
    performDropRef.current = performDrop;
  }, [performDrop]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        clientX: number;
        clientY: number;
        target: EventTarget | null;
      };
      performDropRef.current(detail);
    };
    document.addEventListener('composer-touch-drop', handler);
    return () => document.removeEventListener('composer-touch-drop', handler);
  }, []);

  const updateEdgeHoverState = useCallback(
    (edgeId: string, isHovered: boolean) => {
      setEdges((prevEdges) =>
        prevEdges.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  isHovered,
                },
              }
            : edge,
        ),
      );
    },
    [setEdges],
  );

  const onEdgeMouseEnter = useCallback(
    (_: unknown, edge: Edge) => updateEdgeHoverState(edge.id, true),
    [updateEdgeHoverState],
  );

  const onEdgeMouseLeave = useCallback(
    (_: unknown, edge: Edge) => updateEdgeHoverState(edge.id, false),
    [updateEdgeHoverState],
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      resolveNodeCollisions(node, nodes, setNodes);
    },
    [nodes, setNodes],
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedIds = new Set(deleted.map((d) => d.id));

      setNodes((nds) => nds.filter((n) => !deletedIds.has(n.id)));

      setEdges((eds) =>
        eds.filter(
          (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
        ),
      );
    },
    [setNodes, setEdges],
  );

  return (
    <>
      {!blocksLoading ? (
        <ReactFlow
          colorMode={colorMode}
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onNodeDragStop={onNodeDragStop}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          minZoom={0.1}
          multiSelectionKeyCode={null}
          deleteKeyCode={null}
          ref={reactFlowRef}
          className="custom-editor"
        >
          <Controls />
          <Background gap={12} size={1} />
          <svg>
            <defs>
              <linearGradient id="edge-gradient">
                <stop offset="0%" stopColor="#ae53ba" />
                <stop offset="100%" stopColor="#2a8af6" />
              </linearGradient>
            </defs>
          </svg>
        </ReactFlow>
      ) : (
        <div className="flex h-screen w-full items-center justify-center">
          <Spinner />
        </div>
      )}
    </>
  );
};
