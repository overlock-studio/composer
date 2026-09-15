import type { Node as RFNode } from '@xyflow/react';
import type { Block, BlockType, Connector, Pipeline } from '../api/types';
import {
  PATCH_AND_TRANSFORM_STEP,
  type ContainerLayout,
} from './containerLayout';
import { pipelineSteps, resolveContainerLayout } from './containerGraph';
import { PIPELINE_IN_HANDLE, PIPELINE_OUT_HANDLE } from './editorUtils';
import type { ContainerNodeData } from './types';
import type {
  ResourceEdgeInput,
  SerializerCompositionInput,
} from './serializer';

const stripCompositionPrefix = (name: string, compNames: string[]): string => {
  for (const comp of compNames) {
    if (comp && name.startsWith(`${comp}_`)) return name.slice(comp.length + 1);
  }
  return name;
};

/**
 * Types of the blocks a save hands out. Blocks themselves stay generic — an id,
 * a parent, a position in the parent's space, connectors, edges and free-form
 * `data` — so the same structure can carry other kinds of graph later.
 */
export const BLOCK_TYPES = {
  composition: 'composition',
  connectors: 'connectors',
  function: 'function',
  resource: 'resource',
} as const;

export const functionBlockId = (compositionId: string, step: string): string =>
  `${compositionId}:function:${step}`;

export const connectorsBlockId = (
  compositionId: string,
  connection: 'input' | 'output',
): string => `${compositionId}:${connection === 'input' ? 'spec' : 'status'}`;

// The resources a step's input lists are blocks of their own.
const withoutResources = (
  input: Pipeline['input'] | undefined,
): Record<string, unknown> | undefined =>
  input
    ? Object.fromEntries(
        Object.entries(input).filter(([key]) => key !== 'resources'),
      )
    : undefined;

/**
 * The whole configuration as one flat list of blocks, layout included. Each
 * composition is followed by its Spec and Status blocks, a block per pipeline
 * function — chained by edges in pipeline order — and the resource blocks, whose
 * parent is the function composing them. Every position is in its parent's
 * space: compositions on the root canvas, functions and the Spec and Status
 * blocks on the composition's canvas, resources inside their function.
 */
export const collectBlocks = (nodes: RFNode[]): Block[] =>
  nodes
    .filter((node) => node.type === 'container')
    .flatMap((node) => {
      const data = (node.data ?? {}) as Partial<ContainerNodeData>;
      const { layout, blockOrigin } = resolveContainerLayout(data);
      const width = node.measured?.width;
      const height = node.measured?.height;

      const composition: Block & { apiVersion?: string; kind?: string } = {
        id: node.id,
        parentId: '',
        type: BLOCK_TYPES.composition,
        name: data.name ?? node.id,
        position: {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        },
        ...(width !== undefined && height !== undefined
          ? { size: { width: Math.round(width), height: Math.round(height) } }
          : {}),
        edges: [],
        blockType: data.blockType,
        connectors: data.connectors ?? [],
        apiVersion: data.apiVersion,
        kind: data.kind,
        ...(data.blockData ? { data: data.blockData } : {}),
      };

      // Only placed once the user has moved them; sized once resized.
      const connectorBlocks: Block[] = (['input', 'output'] as const).map(
        (connection) => {
          const placed = layout.connectors[connection];
          return {
            id: connectorsBlockId(node.id, connection),
            parentId: node.id,
            type: BLOCK_TYPES.connectors,
            name: connection === 'input' ? 'spec' : 'status',
            ...(placed ? { position: { x: placed.x, y: placed.y } } : {}),
            ...(placed?.width !== undefined && placed.height !== undefined
              ? { size: { width: placed.width, height: placed.height } }
              : {}),
            edges: [],
            blockType: undefined,
            connectors: [],
            data: { connection },
          };
        },
      );

      const steps = pipelineSteps(data.functions);
      const functionBlocks: Block[] = steps.map((fn, index) => {
        const id = functionBlockId(node.id, fn.step);
        const box = layout.groups[fn.step];
        const next = steps[index + 1];
        const input =
          fn.step === PATCH_AND_TRANSFORM_STEP
            ? withoutResources(fn.input)
            : fn.input;
        return {
          id,
          parentId: node.id,
          type: BLOCK_TYPES.function,
          name: fn.step,
          position: { x: box.x, y: box.y },
          size: { width: box.width, height: box.height },
          edges: next
            ? [
                {
                  source: id,
                  sourceHandle: PIPELINE_OUT_HANDLE,
                  target: functionBlockId(node.id, next.step),
                  targetHandle: PIPELINE_IN_HANDLE,
                },
              ]
            : [],
          blockType: undefined,
          connectors: [],
          // The whole step, so whatever the editor does not model comes back.
          data: { ...fn, ...(input ? { input } : {}) },
        };
      });

      // The editor holds resources on the composition's canvas.
      const resourceParent = functionBlockId(node.id, PATCH_AND_TRANSFORM_STEP);
      const resources: Block[] = (data.childBlocks ?? []).map((block) => ({
        ...block,
        parentId: resourceParent,
        type: BLOCK_TYPES.resource,
        ...(block.position
          ? {
              position: {
                x: Math.round(block.position.x - blockOrigin.x),
                y: Math.round(block.position.y - blockOrigin.y),
              },
            }
          : {}),
      }));

      return [composition, ...connectorBlocks, ...functionBlocks, ...resources];
    });

/**
 * Function blocks in pipeline order: each one's edge to the next is followed
 * from every block nothing points at. Blocks caught in a cycle, or not chained
 * at all, keep their list order after the chains.
 */
const pipelineOrder = (functionBlocks: Block[]): Block[] => {
  const byId = new Map(functionBlocks.map((block) => [block.id, block]));
  const nextOf = new Map<string, string>();
  const hasPrevious = new Set<string>();
  for (const block of functionBlocks) {
    for (const edge of block.edges ?? []) {
      if (edge.source !== block.id || !byId.has(edge.target)) continue;
      nextOf.set(block.id, edge.target);
      hasPrevious.add(edge.target);
    }
  }

  const ordered: Block[] = [];
  const seen = new Set<string>();
  for (const start of functionBlocks) {
    if (hasPrevious.has(start.id)) continue;
    let id: string | undefined = start.id;
    while (id && !seen.has(id)) {
      const block = byId.get(id);
      if (!block) break;
      seen.add(id);
      ordered.push(block);
      id = nextOf.get(id);
    }
  }

  return [
    ...ordered,
    ...functionBlocks.filter((block) => !seen.has(block.id)),
  ];
};

/**
 * The inverse of `collectBlocks`: blocks a save handed out, back in the shape
 * the editor holds. Each composition carries its pipeline, rebuilt from its
 * function blocks, and the layout of its edit mode, from its function, Spec and
 * Status blocks; its resources are parented to it again, placed on its canvas.
 */
export const restoreBlocks = (blocks: Block[]): Block[] => {
  const childrenOf = (id: string): Block[] =>
    blocks.filter((block) => block.parentId === id);

  return blocks
    .filter((block) => block.type === BLOCK_TYPES.composition)
    .flatMap((composition) => {
      const children = childrenOf(composition.id);
      const functionBlocks = pipelineOrder(
        children.filter((block) => block.type === BLOCK_TYPES.function),
      );
      const containerLayout: ContainerLayout = { groups: {}, connectors: {} };

      const functions = functionBlocks.map((block) => {
        const step = String(block.data?.step ?? block.name ?? block.id);
        if (block.position && block.size) {
          containerLayout.groups[step] = { ...block.position, ...block.size };
        }
        return { ...block.data, step } as Pipeline;
      });

      for (const block of children) {
        if (block.type !== BLOCK_TYPES.connectors || !block.position) continue;
        const connection =
          block.data?.connection === 'output' ? 'output' : 'input';
        containerLayout.connectors[connection] = {
          ...block.position,
          ...block.size,
        };
      }

      // Resources are placed inside the function composing them.
      const resources: Block[] = functionBlocks.flatMap((fn) => {
        const origin = fn.position ?? { x: 0, y: 0 };
        return childrenOf(fn.id)
          .filter((block) => block.type === BLOCK_TYPES.resource)
          .map((block) => ({
            ...block,
            parentId: composition.id,
            ...(block.position
              ? {
                  position: {
                    x: block.position.x + origin.x,
                    y: block.position.y + origin.y,
                  },
                }
              : {}),
          }));
      });

      return [...resources, { ...composition, functions, containerLayout }];
    });
};

export const buildCompositionInputs = (
  nodes: RFNode[],
): Record<string, SerializerCompositionInput> => {
  const out: Record<string, SerializerCompositionInput> = {};
  const containers = nodes.filter((n) => n.type === 'container');
  for (const c of containers) {
    const data = (c.data ?? {}) as {
      name?: string;
      kind?: string;
      apiVersion?: string;
      blockType?: BlockType;
      connectors?: Connector[];
      childBlocks?: Block[];
    };
    const compName = data.name ?? c.id;
    const compositeTypeRef =
      data.apiVersion && data.kind
        ? { apiVersion: data.apiVersion, kind: data.kind }
        : data.blockType?.apiVersion && data.blockType?.kind
          ? {
              apiVersion: data.blockType.apiVersion,
              kind: data.blockType.kind,
            }
          : undefined;

    // Blocks are not rendered on the container-level canvas, so the container
    // node carries them and they round-trip through it untouched.
    const resources = (data.childBlocks ?? []).map((block) => {
      const blockData = block as Block & {
        apiVersion?: string;
        kind?: string;
      };
      const fullName = block.name ?? block.id;
      const resourceName = stripCompositionPrefix(fullName, [c.id, compName]);
      const apiVersion =
        blockData.apiVersion ?? block.blockType?.apiVersion ?? '';
      const kind = blockData.kind ?? block.blockType?.kind ?? '';

      const blockEdges: ResourceEdgeInput[] = [];
      for (const e of block.edges ?? []) {
        const transformers = e.transformers;
        if (e.source === block.parentId) {
          blockEdges.push({
            direction: 'fromComposite',
            fromFieldPath: e.sourceHandle ?? '',
            toFieldPath: e.targetHandle ?? '',
            transformers,
          });
        } else if (e.target === block.parentId) {
          blockEdges.push({
            direction: 'toComposite',
            fromFieldPath: e.sourceHandle ?? '',
            toFieldPath: e.targetHandle ?? '',
            transformers,
          });
        }
      }

      return { name: resourceName, apiVersion, kind, edges: blockEdges };
    });

    out[compName] = {
      resources,
      metadata: { name: compName },
      compositeTypeRef,
      connectors: data.connectors ?? [],
      originalName: c.id !== compName ? c.id : undefined,
    };
  }
  return out;
};
