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
import { Connector } from '../api/types';
import { JSONSchemaProps } from './jsonSchema';

export const NODE_TYPES: NodeTypes = {
  resource: ResourceNode,
  container: ContainerNode,
  connector: ConnectorNode,
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

export function resolveNodeCollisions(
  draggedNode: Node,
  allNodes: Node[],
  setNodes: (updateFn: (nodes: Node[]) => Node[]) => void,
): void {
  const isResourceNode = draggedNode.type === 'resource';
  const spacing = isResourceNode ? MIN_RESOURCE_NODE_SPACING : MIN_NODE_SPACING;
  const maxIterations = 50;

  // Filter nodes that can collide with dragged node
  const collidableNodes = allNodes.filter((node) => {
    if (node.type === 'connector') return false;

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
    if (node.type === 'connector') return;

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
