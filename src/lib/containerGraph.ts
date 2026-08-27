import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';
import type { Block, BlockType, Connector } from '../api/types';
import type { ContainerNodeData, Handle, ResourceNodeData } from './types';
import {
  buildTreeData,
  connectorToHandle,
  getHandleByPath,
  getHandlesFromSchema,
  handleToConnector,
  CONNECTOR_GROUP_WIDTH,
  RESOURCE_NODE_WIDTH,
} from './editorUtils';

const BLOCK_START = { x: 320, y: 80 };
const BLOCK_SPACING = 40;

// The two connector nodes flank the blocks, far enough out to leave room for
// the edges running between them.
const CONNECTOR_COLUMN_GAP = 220;

const CONNECTOR_GROUP_ID_PREFIX = 'connectors:';

export const connectorGroupId = (connection: 'input' | 'output'): string =>
  `${CONNECTOR_GROUP_ID_PREFIX}${connection}`;

export const isConnectorGroupId = (id: string): boolean =>
  id.startsWith(CONNECTOR_GROUP_ID_PREFIX);

/** Handle a connector occupies on its group node — see `ConnectorGroupNode`. */
export const connectorHandleId = (connector: Connector): string =>
  connector.connection === 'output'
    ? `target-${connector.path}`
    : `source-${connector.path}`;

const isInput = (connector: Connector): boolean =>
  connector.connection !== 'output';

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

type ColumnBounds = { minX: number; maxX: number; minY: number };

const blockBounds = (blockNodes: RFNode[]): ColumnBounds => {
  if (!blockNodes.length) {
    return {
      minX: BLOCK_START.x,
      maxX: BLOCK_START.x + RESOURCE_NODE_WIDTH,
      minY: BLOCK_START.y,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;

  for (const node of blockNodes) {
    const width = Number(
      node.measured?.width ?? node.style?.width ?? RESOURCE_NODE_WIDTH,
    );
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x + width);
    minY = Math.min(minY, node.position.y);
  }

  return { minX, maxX, minY };
};

/**
 * The container's own inputs and outputs, as one node each: inputs left of the
 * blocks, outputs to their right. Both are ordinary draggable nodes, so
 * `previous` positions are carried over rather than recomputed once the user
 * has placed them.
 */
export const buildConnectorNodes = (
  connectors: Connector[],
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>,
  blockNodes: RFNode[],
  previous: RFNode[] = [],
): RFNode[] => {
  const { minX, maxX, minY } = blockBounds(blockNodes);
  const placed = new Map(previous.map((node) => [node.id, node.position]));

  return (['input', 'output'] as const).map((connection) => {
    const id = connectorGroupId(connection);
    const defaultX =
      connection === 'input'
        ? minX - CONNECTOR_COLUMN_GAP - CONNECTOR_GROUP_WIDTH
        : maxX + CONNECTOR_COLUMN_GAP;

    return {
      id,
      type: 'connectorGroup',
      position: placed.get(id) ?? { x: defaultX, y: minY },
      style: { width: CONNECTOR_GROUP_WIDTH },
      draggable: true,
      data: {
        connection,
        connectors: connectors.filter((connector) =>
          connection === 'input' ? isInput(connector) : !isInput(connector),
        ),
        setConnectors,
      },
    };
  });
};

/**
 * Graph shown when a container is opened for editing: one node per block of
 * that container, the two nodes holding its inputs and outputs, and the edges
 * running between them. Edges to composite paths the container does not expose
 * as a connector are left out, exactly as they are at the container level.
 */
export const buildContainerGraph = (
  container: RFNode,
  reactFlowRef: React.MutableRefObject<HTMLDivElement | null> | null,
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>,
): { nodes: RFNode[]; edges: RFEdge[] } => {
  const data = (container.data ?? {}) as ContainerNodeData;
  const blocks = data.childBlocks ?? [];
  const connectors = data.connectors ?? [];
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
  const inputs = new Map<string, Connector>();
  const outputs = new Map<string, Connector>();
  for (const connector of connectors) {
    (isInput(connector) ? inputs : outputs).set(connector.path, connector);
  }

  const edges: RFEdge[] = [];

  for (const block of blocks) {
    for (const edge of block.edges ?? []) {
      let source = edge.source;
      let sourceHandle = edge.sourceHandle ?? undefined;
      let target = edge.target;
      let targetHandle = edge.targetHandle ?? undefined;

      // An endpoint on the container itself is a patch from/to the composite:
      // on this canvas it hangs off the matching connector node.
      if (source === container.id) {
        const connector = inputs.get(sourceHandle ?? '');
        if (!connector) continue;
        source = connectorGroupId('input');
        sourceHandle = connectorHandleId(connector);
      } else if (!blockIds.has(source)) {
        continue;
      }

      if (target === container.id) {
        const connector = outputs.get(targetHandle ?? '');
        if (!connector) continue;
        target = connectorGroupId('output');
        targetHandle = connectorHandleId(connector);
      } else if (!blockIds.has(target)) {
        continue;
      }

      const id = `${source}-${sourceHandle}-${target}-${targetHandle}`;
      if (edges.some((existing) => existing.id === id)) continue;
      edges.push({
        id,
        type: 'customEdge',
        source,
        sourceHandle,
        target,
        targetHandle,
        data: { transformers: edge.transformers, reactFlowRef },
      });
    }
  }

  return {
    nodes: [...nodes, ...buildConnectorNodes(connectors, setConnectors, nodes)],
    edges,
  };
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
