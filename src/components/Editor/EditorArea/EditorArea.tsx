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
  FinalConnectionState,
  Node,
  useNodesInitialized,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEditorAreaContext } from '../EditorAreaContext';
import {
  buildTreeData,
  connectorForDroppedHandle,
  connectorRowHandleId,
  EDGE_TYPES,
  NODE_TYPES,
  CONTAINER_NODE_WIDTH,
  PIPELINE_GROUP_HEADER_HEIGHT,
  PIPELINE_GROUP_MIN_HEIGHT,
  PIPELINE_GROUP_MIN_WIDTH,
  PIPELINE_IN_HANDLE,
  PIPELINE_OUT_HANDLE,
  RESOURCE_NODE_WIDTH,
  resolveNodeCollisions,
} from '../../../lib/editorUtils';
import {
  buildConnectorNodes,
  buildContainerGraph,
  connectorGroupId,
  connectorHandleIds,
  holdsResourceBlocks,
  isConnectorGroupId,
  mergeContainerIntoNodes,
  pipelineGroupNode,
} from '../../../lib/containerGraph';
import {
  closesPipelineLoop,
  functionRefName,
  linkPipelineSteps,
  uniqueStepName,
} from '../../../lib/pipelineChain';
import { useToast } from '../../../hooks/use-toast';
import { Spinner } from '../../Spinner';
import { Block, Connector, Pipeline } from '../../../api/types';
import type {
  PipelineGroupNodeData,
  ResourceNodeData,
} from '../../../lib/types';
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

const containsPoint = (
  node: Node,
  point: { x: number; y: number },
): boolean => {
  const width = Number(node.measured?.width ?? node.style?.width ?? 0);
  const height = Number(node.measured?.height ?? node.style?.height ?? 0);
  return (
    point.x >= node.position.x &&
    point.x <= node.position.x + width &&
    point.y >= node.position.y &&
    point.y <= node.position.y + height
  );
};

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
    selectedFunction,
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
    setActiveHandle,
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
          containerLayout: container.containerLayout,
          blockData: container.data,
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
      const graph = buildContainerGraph(container, setContainerConnectors);
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
        prev.filter(holdsResourceBlocks),
        prev.filter((node) => node.type === 'connectorGroup'),
      ),
    ]);

    // Rows, not connectors: a branch row keeps its edge for as long as
    // something still lives under it.
    const live = connectorHandleIds(connectors);
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
      // The pipeline chain is its own kind of edge: a step leads to exactly
      // one next step.
      if (params.sourceHandle === PIPELINE_OUT_HANDLE) {
        setEdges((eds) => linkPipelineSteps(eds, params.source, params.target));
        return;
      }
      setEdges((eds) =>
        addEdge({ ...params, type: 'customEdge' }, eds),
      );
    },
    [setEdges],
  );

  // An edge from a block handle dropped on the + of the spec or status node
  // adds a connector named after that handle and wires the edge to it. Spec
  // rows feed block inputs and status rows take block outputs, so each + only
  // answers the one kind of handle.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      const { fromNode, fromHandle } = state;
      if (state.isValid || !fromNode || !fromHandle?.id) return;
      if (isConnectorGroupId(fromNode.id)) return;

      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const connection = document
        .elementFromPoint(point.clientX, point.clientY)
        ?.closest<HTMLElement>('[data-connector-add]')?.dataset.connectorAdd;
      if (connection !== 'input' && connection !== 'output') return;
      if (fromHandle.type !== (connection === 'input' ? 'target' : 'source'))
        return;

      const data = fromNode.data as Partial<ResourceNodeData>;
      const handle = (data.currentHandles ?? data.initialHandles)?.find(
        (item) => item.path === fromHandle.id,
      );
      const connector = connectorForDroppedHandle(
        fromHandle.id,
        connection,
        handle,
      );
      setContainerConnectors((prev) =>
        prev.some(
          (item) =>
            item.path === connector.path &&
            item.connection === connector.connection,
        )
          ? prev
          : [...prev, connector],
      );

      const row = {
        node: connectorGroupId(connection),
        handle: connectorRowHandleId(connector.path, connection),
      };
      const block = { node: fromNode.id, handle: fromHandle.id };
      const [source, target] =
        connection === 'input' ? [row, block] : [block, row];
      onConnect({
        source: source.node,
        sourceHandle: source.handle,
        target: target.node,
        targetHandle: target.handle,
      });
    },
    [onConnect, setContainerConnectors],
  );

  // Chain handles only meet each other, and never so that the pipeline loops.
  // A patch has a block at one end at least, so the spec and status nodes are
  // not wired to each other.
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      if (
        isConnectorGroupId(connection.source) &&
        isConnectorGroupId(connection.target)
      )
        return false;
      const fromChain = connection.sourceHandle === PIPELINE_OUT_HANDLE;
      const toChain = connection.targetHandle === PIPELINE_IN_HANDLE;
      if (fromChain !== toChain) return false;
      return (
        !fromChain ||
        !closesPipelineLoop(edges, connection.source, connection.target)
      );
    },
    [edges],
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
      const { clientX, clientY } = opts;
      const position = screenToFlowPosition({ x: clientX, y: clientY });

      // A function becomes a pipeline step of its own, drawn as a group where
      // it was dropped and linked into the chain by hand.
      if (selectedFunction) {
        if (editorMode !== 'container') return;
        const refName = functionRefName(selectedFunction.url);
        const step = uniqueStepName(
          nodes
            .filter((node) => node.type === 'pipelineGroup')
            .map((node) => (node.data as PipelineGroupNodeData).step),
          refName,
        );
        const group = pipelineGroupNode(
          { step, functionRef: { name: refName } } as Pipeline,
          {
            x: position.x - PIPELINE_GROUP_MIN_WIDTH / 2,
            y: position.y - PIPELINE_GROUP_HEADER_HEIGHT / 2,
            width: PIPELINE_GROUP_MIN_WIDTH,
            height: PIPELINE_GROUP_MIN_HEIGHT,
          },
          false,
        );
        // Groups go first, ahead of the blocks nested in them.
        setNodes((nds) => [group, ...nds]);
        return;
      }

      if (!selectedBlockType) return;
      const id = nextUniqueNodeName(nodes, selectedBlockType);
      let newNode: Node | null = null;

      // Each canvas takes its own kind of block: containers at the container
      // level, provider blocks inside a container.
      if (editorMode === 'container') {
        if (!selectedBlockType.leaf) return;

        // Blocks belong to a pipeline step, so they are only ever dropped into
        // the patch-and-transform group and are positioned relative to it.
        const group = nodes.find(
          (node) =>
            node.type === 'pipelineGroup' &&
            (node.data as PipelineGroupNodeData).holdsResources,
        );
        if (!group || !containsPoint(group, position)) {
          toast({
            title: 'Blocks belong to the patch-and-transform step',
            description: 'Drop the block inside that group to add it.',
          });
          return;
        }

        newNode = {
          id,
          position: {
            x: position.x - group.position.x,
            y: position.y - group.position.y,
          },
          parentId: group.id,
          extent: 'parent',
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
      selectedFunction,
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

  // Focus follows the last thing touched: clicking the canvas or a node body
  // drops the handle the user lit up earlier, instead of leaving it glowing
  // over an interaction it has nothing to do with.
  const clearHandleFocus = useCallback(
    () => setActiveHandle(null),
    [setActiveHandle],
  );

  // Clicks that never reach the canvas — the sidebar, a toolbar, a dialog —
  // still count as looking away from a lit handle.
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const canvas = reactFlowRef.current;
      if (canvas && !canvas.contains(event.target as globalThis.Node)) {
        setActiveHandle(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [setActiveHandle]);

  // Escape is the way out that does not need the handle or edge to be found
  // again to click it off.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActiveHandle(null);
      setEdges((eds) =>
        eds.map((ed) => (ed.selected ? { ...ed, selected: false } : ed)),
      );
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveHandle, setEdges]);

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
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
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
          onPaneClick={clearHandleFocus}
          onNodeClick={clearHandleFocus}
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
