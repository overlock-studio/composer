import type { Node as RFNode } from '@xyflow/react';
import type { Block, BlockType, Connector, Pipeline } from '../api/types';
import {
  SELF_POSITION_KEY,
  type CompositionLayout,
  type LayoutByComposition,
} from './parser';
import {
  connectorLayoutKey,
  pipelineLayoutKey,
  PATCH_AND_TRANSFORM_STEP,
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
          data: {
            step: fn.step,
            ...(fn.functionRef ? { functionRef: fn.functionRef } : {}),
            ...(input ? { input } : {}),
          },
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
 * The layout file for blocks from `collectBlocks`, in the shape the editor
 * reads back: per composition, `_self` for the composition, `_pipeline:<step>`
 * for each function, `_spec` and `_status` once placed, and one entry per
 * resource, relative to its function.
 */
export const layoutFromBlocks = (blocks: Block[]): LayoutByComposition => {
  const out: LayoutByComposition = {};
  const childrenOf = (id: string): Block[] =>
    blocks.filter((block) => block.parentId === id);

  for (const composition of blocks.filter(
    (block) => block.type === BLOCK_TYPES.composition,
  )) {
    const compName = composition.name ?? composition.id;
    const entries: CompositionLayout = {};

    for (const child of childrenOf(composition.id)) {
      if (child.type === BLOCK_TYPES.function) {
        if (child.position && child.size) {
          const step = String(child.data?.step ?? child.name ?? child.id);
          entries[pipelineLayoutKey(step)] = {
            ...child.position,
            ...child.size,
          };
        }
        for (const resource of childrenOf(child.id)) {
          if (resource.type !== BLOCK_TYPES.resource || !resource.position) {
            continue;
          }
          const resourceName = stripCompositionPrefix(
            resource.name ?? resource.id,
            [composition.id, compName],
          );
          entries[resourceName] = {
            x: resource.position.x,
            y: resource.position.y,
          };
        }
      } else if (child.type === BLOCK_TYPES.connectors && child.position) {
        const connection =
          child.data?.connection === 'output' ? 'output' : 'input';
        entries[connectorLayoutKey(connection)] = {
          ...child.position,
          ...child.size,
        };
      }
    }

    if (composition.position) {
      entries[SELF_POSITION_KEY] = {
        ...composition.position,
        ...composition.size,
      };
    }

    out[compName] = entries;
  }

  return out;
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
