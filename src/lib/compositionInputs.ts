import type { Node as RFNode } from '@xyflow/react';
import type { Block, BlockType, Connector } from '../api/types';
import {
  SELF_POSITION_KEY,
  type CompositionLayout,
  type LayoutByComposition,
} from './parser';
import { connectorLayoutKey, pipelineLayoutKey } from './containerLayout';
import { resolveContainerLayout } from './containerGraph';
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
 * The whole configuration as blocks, layout included: each container, with its
 * position, size and full edit-mode layout (a box per pipeline group, and
 * wherever the Spec and Status nodes were put), followed by the resource blocks
 * it holds, with their patches as edges. Resource positions are relative to the
 * group holding them, so moving the group never changes them.
 */
export const collectBlocks = (nodes: RFNode[]): Block[] =>
  nodes
    .filter((node) => node.type === 'container')
    .flatMap((node) => {
      const data = (node.data ?? {}) as Partial<ContainerNodeData>;
      const { layout, blockOrigin } = resolveContainerLayout(data);
      const width = node.measured?.width;
      const height = node.measured?.height;
      const container: Block & { apiVersion?: string; kind?: string } = {
        id: node.id,
        parentId: '',
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
        functions: data.functions ?? [],
        containerLayout: layout,
        apiVersion: data.apiVersion,
        kind: data.kind,
      };
      // The editor holds blocks on the container's canvas.
      const children = (data.childBlocks ?? []).map((block) =>
        block.position
          ? {
              ...block,
              position: {
                x: Math.round(block.position.x - blockOrigin.x),
                y: Math.round(block.position.y - blockOrigin.y),
              },
            }
          : block,
      );
      return [container, ...children];
    });

/**
 * The layout file for blocks from `collectBlocks`, in the shape the editor
 * reads back: per composition, `_self` for the container, `_pipeline:<step>`
 * for each group, `_spec` and `_status` for the connector nodes once placed,
 * and one entry per resource, relative to its group.
 */
export const layoutFromBlocks = (blocks: Block[]): LayoutByComposition => {
  const out: LayoutByComposition = {};

  for (const container of blocks.filter((block) => !block.parentId)) {
    const compName = container.name ?? container.id;
    const entries: CompositionLayout = {};

    for (const block of blocks) {
      if (block.parentId !== container.id || !block.position) continue;
      const resourceName = stripCompositionPrefix(block.name ?? block.id, [
        container.id,
        compName,
      ]);
      entries[resourceName] = { x: block.position.x, y: block.position.y };
    }

    const layout = container.containerLayout;
    for (const [step, box] of Object.entries(layout?.groups ?? {})) {
      entries[pipelineLayoutKey(step)] = box;
    }
    for (const connection of ['input', 'output'] as const) {
      const placed = layout?.connectors[connection];
      if (placed) entries[connectorLayoutKey(connection)] = placed;
    }

    if (container.position) {
      entries[SELF_POSITION_KEY] = {
        ...container.position,
        ...container.size,
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
