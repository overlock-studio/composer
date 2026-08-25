import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';
import type { Block, BlockType } from '../api/types';
import type { ContainerNodeData, Handle, ResourceNodeData } from './types';
import {
  buildTreeData,
  connectorToHandle,
  getHandleByPath,
  getHandlesFromSchema,
  handleToConnector,
  RESOURCE_NODE_WIDTH,
} from './editorUtils';

const BLOCK_START = { x: 320, y: 80 };
const BLOCK_SPACING = 40;

const handlesForBlock = (block: Block, blockType: BlockType): Handle[] => {
  const handles: Handle[] =
    block.connectors && block.connectors.length > 0
      ? block.connectors.map(connectorToHandle)
      : getHandlesFromSchema({ schema: blockType.schema });

  // Patched paths that the schema does not expose still need a handle to hang
  // their edge on.
  const ensure = (path: string | undefined, type: 'source' | 'target') => {
    if (!path || handles.some((handle) => handle.path === path)) return;
    const fromSchema = getHandleByPath(blockType.schema, path);
    handles.push(fromSchema ?? { path, description: '', type });
  };

  for (const edge of block.edges ?? []) {
    if (edge.source === block.id) ensure(edge.sourceHandle, 'source');
    if (edge.target === block.id) ensure(edge.targetHandle, 'target');
  }

  return handles;
};

/**
 * Graph shown when a container is opened for editing: one node per block of
 * that container, plus the edges that run between those blocks. Edges to the
 * container's own inputs/outputs are kept on the blocks and rendered once
 * those become nodes of their own.
 */
export const buildContainerGraph = (
  container: RFNode,
  reactFlowRef: React.MutableRefObject<HTMLDivElement | null> | null,
): { nodes: RFNode[]; edges: RFEdge[] } => {
  const data = (container.data ?? {}) as ContainerNodeData;
  const blocks = data.childBlocks ?? [];
  const nodes: RFNode[] = [];
  let offset = 0;

  for (const block of blocks) {
    const blockType = block.blockType;
    if (!blockType?.schema) continue;

    const initialHandles = handlesForBlock(block, blockType);
    const position = block.position ?? {
      x: BLOCK_START.x,
      y: BLOCK_START.y + offset,
    };
    offset += (block.size?.height ?? 0) + BLOCK_SPACING;

    nodes.push({
      id: block.id,
      type: 'resource',
      position,
      style: { width: RESOURCE_NODE_WIDTH },
      draggable: true,
      data: {
        label: block.name ?? block.id,
        name: block.name ?? block.id,
        initialHandles,
        currentHandles:
          block.connectors && block.connectors.length > 0
            ? block.connectors.map(connectorToHandle)
            : undefined,
        treeData: buildTreeData(blockType.schema),
        apiEdges: block.edges,
        blockType,
      },
    });
  }

  const blockIds = new Set(nodes.map((node) => node.id));
  const edges: RFEdge[] = [];

  for (const block of blocks) {
    for (const edge of block.edges ?? []) {
      if (!blockIds.has(edge.source) || !blockIds.has(edge.target)) continue;
      const id = `${edge.source}-${edge.sourceHandle}-${edge.target}-${edge.targetHandle}`;
      if (edges.some((existing) => existing.id === id)) continue;
      edges.push({
        id,
        type: 'customEdge',
        source: edge.source,
        sourceHandle: edge.sourceHandle ?? undefined,
        target: edge.target,
        targetHandle: edge.targetHandle ?? undefined,
        data: { transformers: edge.transformers, reactFlowRef },
      });
    }
  }

  return { nodes, edges };
};

/**
 * Folds an edited container graph back into the container node, so the blocks
 * it carries stay in sync with what was done on its own canvas.
 */
export const collectContainerBlocks = (
  container: RFNode,
  graphNodes: RFNode[],
): Block[] => {
  const data = (container.data ?? {}) as ContainerNodeData;
  const previous = new Map(
    (data.childBlocks ?? []).map((block) => [block.id, block]),
  );

  return graphNodes
    .filter((node) => node.type === 'resource')
    .map((node) => {
      const nodeData = (node.data ?? {}) as ResourceNodeData;
      const handles = nodeData.currentHandles ?? nodeData.initialHandles ?? [];
      const connectors = handles.map(handleToConnector);
      const existing = previous.get(node.id);

      if (existing) {
        return { ...existing, position: node.position, connectors };
      }

      return {
        id: node.id,
        parentId: container.id,
        name: node.id,
        position: node.position,
        edges: [],
        blockType: nodeData.blockType,
        connectors,
      };
    });
};
