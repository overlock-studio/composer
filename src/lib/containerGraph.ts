import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';
import type { Block, BlockType, Connector } from '../api/types';
import type { ContainerNodeData, Handle, ResourceNodeData } from './types';
import {
  buildTreeData,
  connectorLabels,
  connectorToHandle,
  getHandleByPath,
  getHandlesFromSchema,
  handleToConnector,
  RESOURCE_NODE_WIDTH,
} from './editorUtils';

const BLOCK_START = { x: 320, y: 80 };
const BLOCK_SPACING = 40;

// Connector nodes are round and fixed-size (see `.react-flow__node-connector`),
// stacked in a column on either side of the blocks.
const CONNECTOR_NODE_SIZE = 48;
const CONNECTOR_SPACING = 60;
const CONNECTOR_COLUMN_GAP = 220;

const CONNECTOR_NODE_ID_PREFIX = 'connector:';

export const connectorNodeId = (connector: Connector): string =>
  `${CONNECTOR_NODE_ID_PREFIX}${connector.connection}:${connector.path}`;

const addSlotNodeId = (connection: 'input' | 'output'): string =>
  `${CONNECTOR_NODE_ID_PREFIX}add:${connection}`;

export const isConnectorNodeId = (id: string): boolean =>
  id.startsWith(CONNECTOR_NODE_ID_PREFIX);

/** Handle a connector node exposes — see `ConnectorNode`. */
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
 * The container's own inputs and outputs as nodes of its canvas: inputs in a
 * column left of the blocks, outputs in one to their right, each carrying the
 * single handle blocks wire to. The trailing slot of each column is the
 * affordance for adding one more connector.
 */
export const buildConnectorNodes = (
  connectors: Connector[],
  setConnectors: React.Dispatch<React.SetStateAction<Connector[]>>,
  blockNodes: RFNode[],
): RFNode[] => {
  const { minX, maxX, minY } = blockBounds(blockNodes);
  const labels = connectorLabels(connectors);

  const columns: {
    connection: 'input' | 'output';
    x: number;
    items: Connector[];
  }[] = [
    {
      connection: 'input',
      x: minX - CONNECTOR_COLUMN_GAP - CONNECTOR_NODE_SIZE,
      items: connectors.filter(isInput),
    },
    {
      connection: 'output',
      x: maxX + CONNECTOR_COLUMN_GAP,
      items: connectors.filter((connector) => !isInput(connector)),
    },
  ];

  const nodes: RFNode[] = [];

  for (const column of columns) {
    column.items.forEach((connector, index) => {
      nodes.push({
        id: connectorNodeId(connector),
        type: 'connector',
        position: { x: column.x, y: minY + index * CONNECTOR_SPACING },
        draggable: false,
        data: { connector, setConnectors, label: labels[connector.path] },
      });
    });

    nodes.push({
      id: addSlotNodeId(column.connection),
      type: 'connector',
      position: {
        x: column.x,
        y: minY + column.items.length * CONNECTOR_SPACING,
      },
      draggable: false,
      selectable: false,
      data: { placeholder: column.connection, setConnectors },
    });
  }

  return nodes;
};

/**
 * Graph shown when a container is opened for editing: one node per block of
 * that container and one per connector it exposes, plus the edges running
 * between them. Edges to composite paths the container does not expose as a
 * connector are left out, exactly as they are at the container level.
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
        source = connectorNodeId(connector);
        sourceHandle = connectorHandleId(connector);
      } else if (!blockIds.has(source)) {
        continue;
      }

      if (target === container.id) {
        const connector = outputs.get(targetHandle ?? '');
        if (!connector) continue;
        target = connectorNodeId(connector);
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
