'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  MonitoringAreaProvider,
  useMonitoringAreaContext,
} from '../MonitoringAreaContext';
import { EDGE_TYPES, NODE_TYPES } from '../../../lib/editorUtils';
import { Block } from '../../../api/types';
import { useToast } from '../../../hooks/use-toast';
import { Spinner } from '../../Spinner';
import logger from '../../../lib/logger';

const MonitoringAreaContent = ({
  environmentId,
}: {
  environmentId: bigint;
}) => {
  const reactFlowRef = useRef<HTMLDivElement | null>(null);
  const { nodes, onNodesChange, setNodes, edges, setEdges, onEdgesChange } =
    useMonitoringAreaContext();

  const { toast } = useToast();

  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [blocksLoading, setBlocksLoading] = useState<boolean>(true);

  const fetchBlocks = async () => {
    setEdges([]);
    setNodes([]);
    setBlocksLoading(true);

    try {
      const fetchedBlocks: Block[] = [];

      setBlocks(fetchedBlocks);
    } catch (e) {
      logger.info(e);

      toast({
        title: 'Unable to retrieve data for this environment',
        description: `${e}`,
      });
    }

    setBlocksLoading(false);
  };

  useEffect(() => {
    fetchBlocks();
  }, [environmentId]);

  const createNodesFromBlocks = useCallback(() => {
    if (!blocks) return;

    const containerNodes = blocks.filter((block) => block.parentId === '');
    const newNodes: Node[] = [];

    containerNodes.forEach((container) => {
      const { blockType, id, connectors } = container;

      if (nodes.some((node) => node.id === id)) return;

      const childBlocks = blocks.filter((block) => block.parentId === id);

      newNodes.push({
        id,
        position: { x: 0, y: 0 },
        type: 'container',
        data: { label: id, connectors, childBlocks, reactFlowRef, blockType },
      });
    });

    if (newNodes.length) {
      setNodes((prev) => [...prev, ...newNodes]);
    }
  }, [blocks, setNodes]);

  useEffect(() => {
    createNodesFromBlocks();
  }, [createNodesFromBlocks, blocks]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, type: 'customEdge', data: { reactFlowRef } }, eds),
      );
    },
    [setEdges],
  );

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

  return (
    <>
      {!blocksLoading ? (
        <ReactFlow
          fitView
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          minZoom={0.2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          multiSelectionKeyCode={null}
          ref={reactFlowRef}
          className="custom-editor"
        >
          <Controls />
          <MiniMap position="bottom-right" />
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

export const MonitoringArea = ({
  environmentId,
}: {
  environmentId: bigint;
}) => (
  <ReactFlowProvider>
    <MonitoringAreaProvider>
      <MonitoringAreaContent environmentId={environmentId} />
    </MonitoringAreaProvider>
  </ReactFlowProvider>
);
