import { NodeTypes, Node } from '@xyflow/react';
import {
  Handle,
  HandleTreeNode,
  JsonObject,
  MatchTransform,
  MathTransform,
  StringTransform,
  DragPosition,
  DefaultPosition,
} from './types';
import { ResourceNode } from '../components/Editor/Nodes/ResourceNode';
import { CustomEdge } from '../components/Editor/CustomEdge';
import { ContainerNode } from '../components/Editor/Nodes/ContainerNode';
import { ConnectorNode } from '../components/Editor/Nodes/ConnectorNode';
import { ConnectorGroupNode } from '../components/Editor/Nodes/ConnectorGroupNode';
import { PipelineGroupNode } from '../components/Editor/Nodes/PipelineGroupNode';
import { Connector } from '../api/types';
import { JSONSchemaProps } from './jsonSchema';

export const NODE_TYPES: NodeTypes = {
  resource: ResourceNode,
  container: ContainerNode,
  connector: ConnectorNode,
  connectorGroup: ConnectorGroupNode,
  pipelineGroup: PipelineGroupNode,
};

export const EDGE_TYPES = {
  customEdge: CustomEdge,
};

export const TRANSFORMERS_DEFAULT: {
  map: { type: 'map'; map: Record<string, string> };
  string: { type: 'string'; string: StringTransform };
  math: { type: 'math'; math: MathTransform };
  match: { type: 'match'; match: MatchTransform };
} = {
  map: { type: 'map', map: { '': '' } },
  string: { type: 'string', string: { type: 'Convert', convert: 'ToUpper' } },
  math: { type: 'math', math: { type: 'clampMin', clampMin: 0 } },
  match: {
    type: 'match',
    match: { patterns: [{ type: 'literal', literal: '', result: '' }] },
  },
};

export const RESOURCE_NODE_WIDTH = 300;

export const EDIT_TRANSFORMER_MENU_WIDTH = 300;

export const MIN_NODE_SPACING = 50;

export const MIN_RESOURCE_NODE_SPACING = 25;

export const MIN_CONTAINER_HEIGHT = 300;
export const MIN_CONTAINER_WIDTH = 500;

// Container nodes render as regular nodes: a header plus one handle row per
// connector, so their width is fixed and their height follows the content.
export const CONTAINER_NODE_WIDTH = 340;
export const CONTAINER_HANDLE_SPACING = 30;

// The two nodes holding a container's connectors while it is open: a header
// plus one fixed-height row per connector, so a row's handle can be placed by
// index.
export const CONNECTOR_GROUP_WIDTH = 200;
export const CONNECTOR_GROUP_HEADER_HEIGHT = 32;
export const CONNECTOR_GROUP_ROW_HEIGHT = 30;
// Connector rows are drawn as a tree: one indent step per path segment, and
// the reach a first child needs to meet the row above it.
export const CONNECTOR_TREE_INDENT = 12;
export const CONNECTOR_TREE_REACH = 9;
export const CONNECTOR_TREE_RADIUS = 4;

// Pipeline steps are drawn as subflow groups: a header strip plus padding
// around whatever blocks the step holds.
export const PIPELINE_GROUP_HEADER_HEIGHT = 30;
export const PIPELINE_GROUP_PADDING = 28;
export const PIPELINE_GROUP_MIN_WIDTH = 380;
export const PIPELINE_GROUP_MIN_HEIGHT = 220;
export const PIPELINE_GROUP_GAP = 80;

// Handles carrying the chain from one pipeline step to the next.
export const PIPELINE_IN_HANDLE = 'pipeline-in';
export const PIPELINE_OUT_HANDLE = 'pipeline-out';

// Height of the container node header. Child nodes are kept below this so they
// don't overlap the header (title/actions) when placed or dragged.
export const CONTAINER_HEADER_HEIGHT = 44;

export function getHandlesFromSchema(props: {
  schema: JSONSchemaProps;
  path?: string[];
  isParentRequired?: boolean;
  type?: 'target' | 'source';
}): Handle[] {
  const { schema, path = [], isParentRequired = true } = props;
  const result: Handle[] = [];

  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (typeof subSchema === 'object' && subSchema !== null) {
        const isCurrentRequired =
          ['spec', 'status'].includes(key) ||
          (isParentRequired &&
            Array.isArray(schema.required) &&
            schema.required.includes(key));

        if (isCurrentRequired) {
          const nestedRequired = getHandlesFromSchema({
            schema: subSchema,
            path: [...path, key],
            isParentRequired: isCurrentRequired,
            type: path[0] == 'spec' ? 'target' : 'source',
          });

          if (nestedRequired.length > 0) {
            result.push(...nestedRequired);
          } else {
            if (!['spec', 'status'].includes(key)) {
              const schemaType =
                typeof subSchema === 'object' &&
                subSchema !== null &&
                'type' in subSchema
                  ? (subSchema.type as string) || 'string'
                  : 'string';

              result.push({
                path: [...path, key].join('.'),
                description: subSchema.description ?? '',
                type: path[0] == 'spec' ? 'target' : 'source',
                schemaType,
                required: isCurrentRequired,
              });
            }
          }
        }
      }
    }
  }

  return result;
}

export function getHandleByPath(
  schema: JSONSchemaProps,
  path: string,
): Handle | undefined {
  const pathParts = path.split('.');
  let current: JSONSchemaProps | undefined = schema;

  for (const key of pathParts) {
    if (!current?.properties || typeof current.properties !== 'object') {
      return undefined;
    }

    const nextElement: JSONSchemaProps = current.properties[key];
    if (!nextElement || typeof nextElement !== 'object') {
      return undefined;
    }

    current = nextElement;
  }

  const schemaType =
    current && typeof current === 'object' && 'type' in current
      ? (current.type as string) || 'string'
      : 'string';

  return {
    path,
    description: current?.description ?? '',
    type: pathParts[0] === 'spec' ? 'target' : 'source',
    schemaType,
    required: false,
  };
}

export const buildTreeData = (
  schema: JSONSchemaProps,
  path: string[] = [],
): HandleTreeNode[] => {
  if (!schema.properties || typeof schema.properties !== 'object') {
    return [];
  }

  const result: HandleTreeNode[] = [];

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (typeof propSchema !== 'object' || propSchema === null) continue;

    const fullPath = [...path, key];

    const treeNode: HandleTreeNode = {
      value: fullPath.join('.'),
      label: propSchema.title ?? key,
      disabled: false,
      children: propSchema.properties
        ? buildTreeData(propSchema, fullPath)
        : undefined,
      title: propSchema.description,
    };

    result.push(treeNode);
  }

  return result;
};

export const extractConnectors = (
  obj: JsonObject,
  parentPath = '',
  parentRequired: string[] = [],
): Connector[] => {
  if (!obj || typeof obj !== 'object') return [];
  let connectors: Connector[] = [];

  if (obj.properties && typeof obj.properties === 'object') {
    const properties = obj.properties as JsonObject;
    const requiredFields = Array.isArray(obj.required) ? obj.required : [];

    for (const key in properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        const subSchema = properties[key] as JsonObject;
        if (!subSchema || typeof subSchema !== 'object') continue;
        const newPath = parentPath ? `${parentPath}.${key}` : key;

        connectors = [
          ...connectors,
          ...extractConnectors(subSchema, newPath, requiredFields as string[]),
        ];
      }
    }
  }

  if (!obj.properties && obj.type) {
    const key = parentPath.split('.').pop() || '';
    const isRequired = parentRequired.includes(key);
    const connection = !parentPath.startsWith('status.') ? 'input' : 'output';

    if (
      parentPath !== 'spec' &&
      parentPath !== 'status' &&
      parentPath !== 'metadata'
    ) {
      connectors.push({
        connection,
        path: parentPath,
        type: obj.type as string,
        required: isRequired,
        description: (obj.description as string) || '',
      });
    }
  }

  return connectors;
};

export function cubicBezierPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  const x =
    Math.pow(1 - t, 3) * p0[0] +
    3 * Math.pow(1 - t, 2) * t * p1[0] +
    3 * (1 - t) * Math.pow(t, 2) * p2[0] +
    Math.pow(t, 3) * p3[0];

  const y =
    Math.pow(1 - t, 3) * p0[1] +
    3 * Math.pow(1 - t, 2) * t * p1[1] +
    3 * (1 - t) * Math.pow(t, 2) * p2[1] +
    Math.pow(t, 3) * p3[1];

  return [x, y];
}

export function generateBezierPoints(
  source: [number, number],
  sourceControl: [number, number],
  targetControl: [number, number],
  target: [number, number],
  n: number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    points.push(
      cubicBezierPoint(t, source, sourceControl, targetControl, target),
    );
  }
  return points;
}

export function getInitialPosition(
  defaultPosition: DefaultPosition,
  boundWidth: number,
  boundHeight: number,
): DragPosition {
  if (typeof defaultPosition === 'object') {
    return defaultPosition;
  }

  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  switch (defaultPosition) {
    case 'left':
      return { x: 0, y: 0 };
    case 'center':
      return {
        x: (viewportWidth - boundWidth) / 2,
        y: (viewportHeight - boundHeight) / 2,
      };
    case 'right':
    default:
      return { x: viewportWidth - boundWidth, y: 0 };
  }
}

export function calculateConstrainedPosition(
  newPos: DragPosition,
  boundWidth: number,
  boundHeight: number,
  snapToEdges = true,
): { position: DragPosition; isAtEdge: boolean } {
  if (typeof window === 'undefined') {
    return { position: newPos, isAtEdge: false };
  }

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const maxX = viewportWidth - boundWidth;
  const minX = -boundWidth;
  const maxY = viewportHeight - boundHeight;

  let finalX = Math.min(Math.max(newPos.x, minX), maxX);
  let finalY = Math.min(Math.max(newPos.y, 0), maxY);

  const atLeftEdge = finalX <= 0;
  const atRightEdge = finalX >= maxX;

  if (snapToEdges) {
    if (atLeftEdge) {
      finalX = 0;
      finalY = 0;
    } else if (atRightEdge) {
      finalX = maxX;
      finalY = 0;
    }
  }

  return {
    position: { x: finalX, y: finalY },
    isAtEdge: atLeftEdge || atRightEdge,
  };
}

/**
 * Short label per connector: the last path segment, qualified with its parent
 * when that segment alone would be ambiguous within the set.
 */
export function connectorLabels(
  connectors: Connector[] | undefined,
): Record<string, string> {
  const counts: Record<string, number> = {};
  for (const connector of connectors || []) {
    const last = connector.path.split('.').pop() || connector.path;
    counts[last] = (counts[last] || 0) + 1;
  }

  const labels: Record<string, string> = {};
  for (const connector of connectors || []) {
    const segments = connector.path.split('.');
    const last = segments[segments.length - 1] || connector.path;
    const parent = segments[segments.length - 2];
    labels[connector.path] =
      counts[last] > 1 && parent ? `${parent}.${last}` : last;
  }
  return labels;
}

/**
 * One row of a connector node: the segment it is named after, plus where it
 * sits in the tree its path belongs to, for the node to draw the lines from.
 *
 * Branch rows are materialised from the path segments, so `spec.db.engine`
 * gives a `db` row even when nothing declares `spec.db` itself. Every row is a
 * handle, and `path` is the composite field it wires to.
 */
export type ConnectorRow = {
  path: string;
  name: string;
  /** How far the row is indented; 0 for a row hanging off the node header. */
  depth: number;
  /** Where in its group of siblings the row sits, for the shape of its elbow. */
  isFirst: boolean;
  isLast: boolean;
  /**
   * One flag per ancestor column left of the row's own, saying whether that
   * ancestor still has rows below — the columns a line has to run through.
   */
  guides: boolean[];
  /** Absent on a branch row that only exists to hold its children. */
  connector?: Connector;
};

type ConnectorTreeNode = {
  name: string;
  path: string;
  connector?: Connector;
  children: ConnectorTreeNode[];
};

// The node's title already says which half of the schema it holds, so that
// first segment is not repeated on every row below it.
const CONNECTOR_ROOT_SEGMENTS = ['spec', 'status'];

/**
 * Connectors as tree rows, in path order: a row per segment, parents before
 * the fields they hold, each carrying its own place in the tree.
 */
export function connectorRows(
  connectors: Connector[] | undefined,
): ConnectorRow[] {
  const roots: ConnectorTreeNode[] = [];
  const byPath = new Map<string, ConnectorTreeNode>();

  for (const connector of connectors || []) {
    const segments = connector.path.split('.').filter(Boolean);
    if (!segments.length) continue;
    const first =
      segments.length > 1 && CONNECTOR_ROOT_SEGMENTS.includes(segments[0])
        ? 1
        : 0;

    let siblings = roots;
    for (let index = first; index < segments.length; index++) {
      const path = segments.slice(0, index + 1).join('.');
      let node = byPath.get(path);
      if (!node) {
        node = { name: segments[index], path, children: [] };
        byPath.set(path, node);
        siblings.push(node);
      }
      siblings = node.children;
    }
    const own = byPath.get(segments.join('.'));
    if (own) own.connector = connector;
  }

  const rows: ConnectorRow[] = [];
  const walk = (
    nodes: ConnectorTreeNode[],
    depth: number,
    guides: boolean[],
  ): void => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      rows.push({
        path: node.path,
        name: node.name,
        depth,
        isFirst: index === 0,
        isLast,
        guides,
        connector: node.connector,
      });
      // Top-level rows hang off the header rather than off a row, so nothing
      // runs through the column they would otherwise open.
      walk(node.children, depth + 1, depth ? [...guides, !isLast] : []);
    });
  };
  walk(roots, 0, []);

  return rows;
}

/**
 * Handle a connector row occupies on its group node: Spec rows start edges,
 * Status rows end them — see `ConnectorGroupNode`.
 */
export const connectorRowHandleId = (
  path: string,
  connection: 'input' | 'output',
): string => (connection === 'output' ? `target-${path}` : `source-${path}`);

export function handleToConnector(handle: Handle): Connector {
  return {
    connection: handle.type === 'source' ? 'output' : 'input',
    path: handle.path,
    type: handle.schemaType || 'string',
    required: handle.required ?? false,
    description: handle.description,
  };
}

export function connectorToHandle(connector: Connector): Handle {
  return {
    path: connector.path,
    description: connector.description,
    type: connector.connection === 'output' ? 'source' : 'target',
    schemaType: connector.type,
    required: connector.required,
  };
}

type NodeRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
};

function rectsIntersect(a: NodeRect, b: NodeRect, margin = 0): boolean {
  return !(
    a.x + a.width + margin <= b.x ||
    b.x + b.width + margin <= a.x ||
    a.y + a.height + margin <= b.y ||
    b.y + b.height + margin <= a.y
  );
}

// Nodes that are laid out rather than jostled: connectors are placed by hand,
// and a pipeline group's footprint follows the blocks it holds.
const isNonCollidingNode = (node: Node): boolean =>
  node.type === 'connector' ||
  node.type === 'connectorGroup' ||
  node.type === 'pipelineGroup';

export function resolveNodeCollisions(
  draggedNode: Node,
  allNodes: Node[],
  setNodes: (updateFn: (nodes: Node[]) => Node[]) => void,
): void {
  if (isNonCollidingNode(draggedNode)) return;

  const isResourceNode = draggedNode.type === 'resource';
  const spacing = isResourceNode ? MIN_RESOURCE_NODE_SPACING : MIN_NODE_SPACING;
  const maxIterations = 50;

  // Filter nodes that can collide with dragged node
  const collidableNodes = allNodes.filter((node) => {
    if (isNonCollidingNode(node)) return false;

    // Container nodes only collide with other container nodes
    if (draggedNode.type === 'container' && node.type !== 'container')
      return false;

    // Resource nodes only collide with resource nodes in same parent
    if (isResourceNode) {
      if (node.type !== 'resource') return false;
      if (node.parentId !== draggedNode.parentId) return false;
    }

    return true;
  });

  if (collidableNodes.length < 2) return;

  // Create mutable position map
  const positions = new Map<string, { x: number; y: number }>();
  collidableNodes.forEach((node) => {
    positions.set(node.id, { x: node.position.x, y: node.position.y });
  });

  // Iteratively resolve all collisions
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let hasCollision = false;

    for (let i = 0; i < collidableNodes.length; i++) {
      for (let j = i + 1; j < collidableNodes.length; j++) {
        const nodeA = collidableNodes[i];
        const nodeB = collidableNodes[j];

        const posA = positions.get(nodeA.id)!;
        const posB = positions.get(nodeB.id)!;

        const rectA: NodeRect = {
          id: nodeA.id,
          x: posA.x,
          y: posA.y,
          width: Number(nodeA.measured?.width || nodeA.style?.width || 300),
          height: Number(nodeA.measured?.height || nodeA.style?.height || 200),
        };

        const rectB: NodeRect = {
          id: nodeB.id,
          x: posB.x,
          y: posB.y,
          width: Number(nodeB.measured?.width || nodeB.style?.width || 300),
          height: Number(nodeB.measured?.height || nodeB.style?.height || 200),
        };

        if (!rectsIntersect(rectA, rectB, spacing)) continue;

        hasCollision = true;

        // Calculate centers and overlap
        const centerAX = rectA.x + rectA.width / 2;
        const centerAY = rectA.y + rectA.height / 2;
        const centerBX = rectB.x + rectB.width / 2;
        const centerBY = rectB.y + rectB.height / 2;

        const dx = centerBX - centerAX;
        const dy = centerBY - centerAY;

        // Calculate overlap amounts
        const overlapX =
          (rectA.width + rectB.width) / 2 + spacing - Math.abs(dx);
        const overlapY =
          (rectA.height + rectB.height) / 2 + spacing - Math.abs(dy);

        // Push nodes apart - move the non-dragged node, or both if neither is dragged
        const moveA = nodeA.id !== draggedNode.id;
        const moveB = nodeB.id !== draggedNode.id;

        if (overlapX < overlapY) {
          // Push horizontally
          const pushX = overlapX / (moveA && moveB ? 2 : 1);
          if (dx >= 0) {
            if (moveA) posA.x -= pushX;
            if (moveB) posB.x += pushX;
          } else {
            if (moveA) posA.x += pushX;
            if (moveB) posB.x -= pushX;
          }
        } else {
          // Push vertically
          const pushY = overlapY / (moveA && moveB ? 2 : 1);
          if (dy >= 0) {
            if (moveA) posA.y -= pushY;
            if (moveB) posB.y += pushY;
          } else {
            if (moveA) posA.y += pushY;
            if (moveB) posB.y -= pushY;
          }
        }
      }
    }

    if (!hasCollision) break;
  }

  // Apply final positions
  setNodes((nodes) =>
    nodes.map((node) => {
      const newPos = positions.get(node.id);
      if (
        newPos &&
        (newPos.x !== node.position.x || newPos.y !== node.position.y)
      ) {
        return {
          ...node,
          position: newPos,
        };
      }
      return node;
    }),
  );
}

export function moveIntersectingNodes(
  resizedNode: Node,
  resizedNodeRect: { x: number; y: number; width: number; height: number },
  intersectingNodes: Node[],
  setNodes: (updateFn: (nodes: Node[]) => Node[]) => void,
): void {
  if (intersectingNodes.length === 0) return;

  const nodesToMove: Array<{
    node: Node;
    newPosition: { x: number; y: number };
  }> = [];
  const isResourceNode = resizedNode.type === 'resource';

  intersectingNodes.forEach((node) => {
    if (node.id === resizedNode.id) return;
    if (isNonCollidingNode(node)) return;

    if (resizedNode.type === 'container' && node.type !== 'container') return;
    if (isResourceNode && node.type !== 'resource') return;

    const nodeRect = {
      x: node.position.x,
      y: node.position.y,
      width: Number(node.measured?.width || node.style?.width || 300),
      height: Number(node.measured?.height || node.style?.height || 200),
    };

    const spacing = isResourceNode
      ? MIN_RESOURCE_NODE_SPACING
      : MIN_NODE_SPACING;

    const resizedCenterX = resizedNodeRect.x + resizedNodeRect.width / 2;
    const resizedCenterY = resizedNodeRect.y + resizedNodeRect.height / 2;
    const nodeCenterX = nodeRect.x + nodeRect.width / 2;
    const nodeCenterY = nodeRect.y + nodeRect.height / 2;

    let newX = nodeRect.x;
    let newY = nodeRect.y;

    const horizontalDistance = Math.abs(resizedCenterX - nodeCenterX);
    const verticalDistance = Math.abs(resizedCenterY - nodeCenterY);

    if (horizontalDistance > verticalDistance) {
      if (nodeCenterX < resizedCenterX) {
        newX = resizedNodeRect.x - nodeRect.width - spacing;
      } else {
        newX = resizedNodeRect.x + resizedNodeRect.width + spacing;
      }
    } else {
      if (nodeCenterY < resizedCenterY) {
        newY = resizedNodeRect.y - nodeRect.height - spacing;
      } else {
        newY = resizedNodeRect.y + resizedNodeRect.height + spacing;
      }
    }

    nodesToMove.push({
      node,
      newPosition: { x: newX, y: newY },
    });
  });

  if (nodesToMove.length > 0) {
    setNodes((nodes) =>
      nodes.map((node) => {
        const moveData = nodesToMove.find((item) => item.node.id === node.id);
        if (moveData) {
          return {
            ...node,
            position: moveData.newPosition,
          };
        }
        return node;
      }),
    );
  }
}
