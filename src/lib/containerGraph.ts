import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';
import type {
  Block,
  BlockType,
  Connector,
  Edge as ApiEdge,
  Pipeline,
} from '../api/types';
import type {
  ContainerNodeData,
  CustomEdgeData,
  Handle,
  PipelineGroupNodeData,
  ResourceNodeData,
} from './types';
import {
  buildTreeData,
  connectorToHandle,
  getHandleByPath,
  getHandlesFromSchema,
  handleToConnector,
  CONNECTOR_GROUP_WIDTH,
  PIPELINE_GROUP_GAP,
  PIPELINE_GROUP_HEADER_HEIGHT,
  PIPELINE_GROUP_MIN_HEIGHT,
  PIPELINE_GROUP_MIN_WIDTH,
  PIPELINE_GROUP_PADDING,
  PIPELINE_IN_HANDLE,
  PIPELINE_OUT_HANDLE,
  RESOURCE_NODE_WIDTH,
} from './editorUtils';

const BLOCK_START = { x: 320, y: 80 };
const BLOCK_SPACING = 40;
const DEFAULT_BLOCK_HEIGHT = 160;

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

/** The pipeline step whose input carries the composition's resources. */
export const PATCH_AND_TRANSFORM_STEP = 'patch-and-transform';

const PIPELINE_GROUP_ID_PREFIX = 'pipeline:';

export const pipelineGroupId = (step: string): string =>
  `${PIPELINE_GROUP_ID_PREFIX}${step}`;

export const isPipelineGroupId = (id: string): boolean =>
  id.startsWith(PIPELINE_GROUP_ID_PREFIX);

/** The one pipeline group blocks live in — the connector columns line up with it. */
export const holdsResourceBlocks = (node: RFNode): boolean =>
  node.type === 'pipelineGroup' &&
  !!(node.data as PipelineGroupNodeData | undefined)?.holdsResources;

const functionName = (fn: Pipeline): string | undefined =>
  (fn.functionRef as { name?: string } | undefined)?.name;

/**
 * Steps of the container's pipeline. A composition written the flat way has no
 * pipeline of its own, so it gets the patch-and-transform step its resources
 * already belong to — the serializer keeps writing them back where it found
 * them either way.
 */
const pipelineSteps = (functions: Pipeline[] | undefined): Pipeline[] => {
  const steps = (functions ?? []).filter((fn) => !!fn?.step);
  if (steps.some((fn) => fn.step === PATCH_AND_TRANSFORM_STEP)) return steps;
  return [...steps, { step: PATCH_AND_TRANSFORM_STEP } as Pipeline];
};

/** Inverse of `connectorHandleId`: back to the composite field path. */
const connectorPathFromHandleId = (
  handleId: string | null | undefined,
): string => (handleId ?? '').replace(/^(source|target)-/, '');

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

type Box = { x: number; y: number; width: number; height: number };

/** Footprint the patch-and-transform group needs to hold its blocks. */
const patchGroupBox = (blockNodes: RFNode[]): Box => {
  if (!blockNodes.length) {
    return {
      x: BLOCK_START.x - PIPELINE_GROUP_PADDING,
      y: BLOCK_START.y - PIPELINE_GROUP_PADDING - PIPELINE_GROUP_HEADER_HEIGHT,
      width: PIPELINE_GROUP_MIN_WIDTH,
      height: PIPELINE_GROUP_MIN_HEIGHT,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of blockNodes) {
    const width = Number(node.style?.width ?? RESOURCE_NODE_WIDTH);
    const height = Number(node.style?.height ?? DEFAULT_BLOCK_HEIGHT);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  const x = minX - PIPELINE_GROUP_PADDING;
  const y = minY - PIPELINE_GROUP_PADDING - PIPELINE_GROUP_HEADER_HEIGHT;
  return {
    x,
    y,
    width: Math.max(
      PIPELINE_GROUP_MIN_WIDTH,
      maxX + PIPELINE_GROUP_PADDING - x,
    ),
    height: Math.max(
      PIPELINE_GROUP_MIN_HEIGHT,
      maxY + PIPELINE_GROUP_PADDING - y,
    ),
  };
};

/**
 * One group per pipeline step, stacked top to bottom in pipeline order: the
 * patch-and-transform group sized around the blocks it holds, the rest above
 * and below it sharing its width so the column lines up. Blocks become children
 * of the patch-and-transform group, so dragging it takes them along.
 */
const buildPipelineGroups = (
  functions: Pipeline[] | undefined,
  blockNodes: RFNode[],
): { groups: RFNode[]; children: RFNode[]; edges: RFEdge[] } => {
  const steps = pipelineSteps(functions);
  const patchIndex = steps.findIndex(
    (fn) => fn.step === PATCH_AND_TRANSFORM_STEP,
  );
  const patchBox = patchGroupBox(blockNodes);

  const boxes: Box[] = new Array(steps.length);
  boxes[patchIndex] = patchBox;

  let above = patchBox.y;
  for (let i = patchIndex - 1; i >= 0; i--) {
    above -= PIPELINE_GROUP_GAP + PIPELINE_GROUP_MIN_HEIGHT;
    boxes[i] = {
      x: patchBox.x,
      y: above,
      width: patchBox.width,
      height: PIPELINE_GROUP_MIN_HEIGHT,
    };
  }

  let below = patchBox.y + patchBox.height;
  for (let i = patchIndex + 1; i < steps.length; i++) {
    below += PIPELINE_GROUP_GAP;
    boxes[i] = {
      x: patchBox.x,
      y: below,
      width: patchBox.width,
      height: PIPELINE_GROUP_MIN_HEIGHT,
    };
    below += PIPELINE_GROUP_MIN_HEIGHT;
  }

  const groups = steps.map((fn, index) => {
    const box = boxes[index];
    const data: PipelineGroupNodeData = {
      step: fn.step,
      functionName: functionName(fn),
      holdsResources: index === patchIndex,
    };
    return {
      id: pipelineGroupId(fn.step),
      type: 'pipelineGroup',
      position: { x: box.x, y: box.y },
      style: { width: box.width, height: box.height },
      draggable: true,
      // Selectable so the resize handles have something to appear on.
      selectable: true,
      data,
    } as RFNode;
  });

  const patchGroup = groups[patchIndex];
  const children = blockNodes.map((node) => ({
    ...node,
    parentId: patchGroup.id,
    extent: 'parent' as const,
    position: {
      x: node.position.x - patchBox.x,
      y: node.position.y - patchBox.y,
    },
  }));

  // The pipeline runs its steps in order, so consecutive groups are chained
  // down the column.
  // That order is the composition's, not something wired by hand, so these
  // edges are not selectable, deletable or reconnectable.
  const edges: RFEdge[] = groups.slice(1).map((group, index) => ({
    id: `pipeline-${groups[index].id}-${group.id}`,
    source: groups[index].id,
    sourceHandle: PIPELINE_OUT_HANDLE,
    target: group.id,
    targetHandle: PIPELINE_IN_HANDLE,
    type: 'smoothstep',
    selectable: false,
    deletable: false,
    focusable: false,
    reconnectable: false,
    className: 'pipeline-step-edge',
  }));

  return { groups, children, edges };
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
 * Graph shown when a container is opened for editing: one group per pipeline
 * step with the blocks living inside the patch-and-transform one, the two nodes
 * holding the container's inputs and outputs, and the edges running between
 * them. Edges to composite paths the container does not expose as a connector
 * are left out, exactly as they are at the container level.
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

  const {
    groups,
    children,
    edges: pipelineEdges,
  } = buildPipelineGroups(data.functions, nodes);

  return {
    // A group has to precede its children for React Flow to nest them.
    nodes: [
      ...groups,
      ...children,
      ...buildConnectorNodes(
        connectors,
        setConnectors,
        groups.filter(holdsResourceBlocks),
      ),
    ],
    edges: [...pipelineEdges, ...edges],
  };
};

/**
 * Turns the edges of an open container's canvas back into the per-block edges
 * the serializer reads: an endpoint on a connector node becomes an endpoint on
 * the container itself, at that connector's own path.
 */
const collectContainerEdges = (
  containerId: string,
  blockIds: Set<string>,
  graphEdges: RFEdge[],
): Map<string, ApiEdge[]> => {
  const byBlock = new Map<string, ApiEdge[]>();

  for (const edge of graphEdges) {
    const sourceIsConnector = isConnectorGroupId(edge.source);
    const targetIsConnector = isConnectorGroupId(edge.target);
    // An edge between two connectors has no block to hang off.
    if (sourceIsConnector && targetIsConnector) continue;

    const source = sourceIsConnector ? containerId : edge.source;
    const target = targetIsConnector ? containerId : edge.target;

    // Patches belong to the resource they are written on, so a composite
    // endpoint hands ownership to the block at the other end; a block-to-block
    // edge is kept on its source so it survives a trip out of edit mode.
    const owner = blockIds.has(source) ? source : target;
    if (!blockIds.has(owner)) continue;

    const transformers = (edge.data as CustomEdgeData | undefined)
      ?.transformers;

    byBlock.set(owner, [
      ...(byBlock.get(owner) ?? []),
      {
        source,
        sourceHandle: sourceIsConnector
          ? connectorPathFromHandleId(edge.sourceHandle)
          : (edge.sourceHandle ?? undefined),
        target,
        targetHandle: targetIsConnector
          ? connectorPathFromHandleId(edge.targetHandle)
          : (edge.targetHandle ?? undefined),
        ...(transformers ? { transformers } : {}),
      },
    ]);
  }

  return byBlock;
};

/**
 * Folds an edited container graph back into the container node, so the blocks
 * it carries — their layout, handles and patches — stay in sync with what was
 * done on its own canvas.
 */
export const collectContainerBlocks = (
  container: RFNode,
  graphNodes: RFNode[],
  graphEdges: RFEdge[],
): Block[] => {
  const data = (container.data ?? {}) as ContainerNodeData;
  const previous = new Map(
    (data.childBlocks ?? []).map((block) => [block.id, block]),
  );
  const blockNodes = graphNodes.filter((node) => node.type === 'resource');
  const edgesByBlock = collectContainerEdges(
    container.id,
    new Set(blockNodes.map((node) => node.id)),
    graphEdges,
  );

  // Blocks sit inside a pipeline group, so their positions are relative to it.
  // Blocks are stored with canvas positions, which is what they are rebuilt
  // from, so the group's own offset is folded back in here.
  const groupPositions = new Map(
    graphNodes
      .filter((node) => node.type === 'pipelineGroup')
      .map((node) => [node.id, node.position]),
  );
  const canvasPosition = (node: RFNode): { x: number; y: number } => {
    const origin = node.parentId
      ? groupPositions.get(node.parentId)
      : undefined;
    return origin
      ? { x: node.position.x + origin.x, y: node.position.y + origin.y }
      : node.position;
  };

  return blockNodes.map((node) => {
    const nodeData = (node.data ?? {}) as ResourceNodeData;
    const handles = nodeData.currentHandles ?? nodeData.initialHandles ?? [];
    const connectors = handles.map(handleToConnector);
    const edges = edgesByBlock.get(node.id) ?? [];
    const position = canvasPosition(node);
    const existing = previous.get(node.id);

    if (existing) {
      return { ...existing, position, connectors, edges };
    }

    return {
      id: node.id,
      parentId: container.id,
      name: node.id,
      position,
      edges,
      blockType: nodeData.blockType,
      connectors,
    };
  });
};

/**
 * The container level with one container's edits folded in. Saving and leaving
 * edit mode both go through this, so what is written is the whole
 * configuration no matter which level happens to be on screen.
 */
export const mergeContainerIntoNodes = (
  parkedNodes: RFNode[],
  containerId: string,
  graphNodes: RFNode[],
  graphEdges: RFEdge[],
  connectors: Connector[],
): RFNode[] => {
  const container = parkedNodes.find((node) => node.id === containerId);
  if (!container) return parkedNodes;

  const childBlocks = collectContainerBlocks(container, graphNodes, graphEdges);

  return parkedNodes.map((node) =>
    node.id === containerId
      ? { ...node, data: { ...node.data, childBlocks, connectors } }
      : node,
  );
};
