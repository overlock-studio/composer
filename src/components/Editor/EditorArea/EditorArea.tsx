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
  RESOURCE_NODE_WIDTH,
  MIN_CONTAINER_HEIGHT,
  MIN_CONTAINER_WIDTH,
  resolveNodeCollisions,
} from '../../../lib/editorUtils';
import { useToast } from '../../../hooks/use-toast';
import { Spinner } from '../../Spinner';
import { Block } from '../../../api/types';
import { CROSSPLANE_XRD_KIND } from '../../../lib/crossplaneCore';
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
  } = useEditorAreaContext();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const { entity, entityId } = entityRef;
  const { toast } = useToast();
  const [hasInitialFitView, setHasInitialFitView] = useState(false);

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

    const containerNodes = blocks.filter((block) => block.parentId === '');
    const newNodes: Node[] = [];

    // Track horizontal offset for positioning multiple compositions
    let horizontalOffset = 0;
    const COMPOSITION_SPACING = 200;

    containerNodes.forEach((container) => {
      const { blockType, id, connectors, name, position, size } = container;
      // Extract kind and apiVersion from block (set by CompositionService) or fallback to blockType
      const kind = (container as any).kind ?? blockType?.kind;
      const apiVersion = (container as any).apiVersion ?? blockType?.apiVersion;

      if (nodes.some((node) => node.id === id)) return;

      const childBlocks = blocks.filter((block) => block.parentId === id);

      const initialWidth = size
        ? Math.max(size.width, MIN_CONTAINER_WIDTH)
        : MIN_CONTAINER_WIDTH;
      const initialHeight = size
        ? Math.max(size.height, MIN_CONTAINER_HEIGHT)
        : MIN_CONTAINER_HEIGHT;

      // Use saved position if exists and is not default (0,0), otherwise position horizontally
      const hasCustomPosition =
        position && (position.x !== 0 || position.y !== 0);
      const nodePosition = hasCustomPosition
        ? position
        : { x: horizontalOffset, y: 0 };

      // Update offset for next composition
      if (!hasCustomPosition) {
        horizontalOffset += initialWidth + COMPOSITION_SPACING;
      }

      const nodeData: any = {
        id,
        position: nodePosition,
        type: 'container',
        data: {
          name: name || id,
          connectors,
          childBlocks,
          reactFlowRef,
          blockType,
          initialWidth,
          initialHeight,
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
  }, [blocks, setNodes]);

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
      const { clientX, clientY, target } = opts;

      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const id = nextUniqueNodeName(nodes, selectedBlockType);
      let newNode: Node | null = null;

      if (selectedBlockType.leaf) {
        const targetEl = target as HTMLElement | null;
        const parentNode = targetEl?.closest?.(
          '[data-parent-id]',
        ) as HTMLElement | null;
        const parentNodeId = parentNode?.dataset.parentId;
        if (!parentNodeId) return;

        const containerNode = nodes.find((n) => n.id === parentNodeId);
        if (!containerNode) return;

        const relativePosition = {
          x: position.x - containerNode.position.x,
          y: position.y - containerNode.position.y,
        };

        const treeData = buildTreeData(selectedBlockType.schema);

        newNode = {
          id,
          position: relativePosition,
          type: 'resource',
          extent: 'parent',
          parentId: parentNodeId,
          style: { width: RESOURCE_NODE_WIDTH },
          draggable: true,
          data: {
            name: id,
            treeData,
            setEdges,
            initialHandles: [],
            blockType: selectedBlockType,
          },
        };
      } else if (selectedBlockType.kind === CROSSPLANE_XRD_KIND) {
        const treeData = selectedBlockType.schema
          ? buildTreeData(selectedBlockType.schema)
          : [];
        newNode = {
          id,
          position,
          type: 'xrd',
          data: {
            name: id,
            blockType: selectedBlockType,
            treeData,
          },
        };
      } else {
        newNode = {
          id,
          position,
          type: 'container',
          data: {
            name: id,
            connectors: [],
            childBlocks: [],
            reactFlowRef,
            blockType: selectedBlockType,
            initialWidth: MIN_CONTAINER_WIDTH,
            initialHeight: MIN_CONTAINER_HEIGHT,
            kind: selectedBlockType.kind,
            apiVersion: selectedBlockType.apiVersion,
          },
        };
      }
      if (newNode) {
        setNodes((nds) => nds.concat(newNode));
      }
    },
    [selectedBlockType, nodes, screenToFlowPosition, setNodes, setEdges],
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

      const getAllChildIds = (parentIds: Set<string>): Set<string> => {
        const newChildIds = nodes
          .filter((n) => parentIds.has(n.parentId || ''))
          .map((n) => n.id);

        if (newChildIds.length === 0) return parentIds;

        const all = new Set([...parentIds, ...newChildIds]);
        return getAllChildIds(all);
      };

      const allToDelete = getAllChildIds(deletedIds);

      setNodes((nds) => nds.filter((n) => !allToDelete.has(n.id)));

      setEdges((eds) =>
        eds.filter(
          (e) => !allToDelete.has(e.source) && !allToDelete.has(e.target),
        ),
      );
    },
    [nodes, setNodes, edges, setEdges],
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
