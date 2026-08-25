import type { Node as RFNode } from '@xyflow/react';
import type { Block, BlockType, Connector } from '../api/types';
import {
  SELF_POSITION_KEY,
  type LayoutByComposition,
  type LayoutEntry,
} from './parser';
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

export const collectPositions = (
  nodes: {
    type?: string;
    position?: { x: number; y: number } | null;
    measured?: { width?: number; height?: number };
    data?: { name?: unknown; childBlocks?: Block[] };
    id: string;
  }[],
  previous: LayoutByComposition,
): LayoutByComposition => {
  const out: LayoutByComposition = {};
  for (const node of nodes) {
    if (node.type !== 'container') continue;
    if (!node.position) continue;
    const x = Math.round(node.position.x);
    const y = Math.round(node.position.y);
    const w = node.measured?.width;
    const h = node.measured?.height;
    const entry: LayoutEntry =
      w !== undefined && h !== undefined
        ? { x, y, width: Math.round(w), height: Math.round(h) }
        : { x, y };

    const compName = (node.data?.name as string | undefined) ?? node.id;
    // Blocks are laid out on the container's own canvas, so their positions
    // come from the blocks the container carries, falling back to what was
    // loaded for containers that were never opened.
    const carried = previous[node.id] ?? previous[compName] ?? {};
    const blockEntries: Record<string, LayoutEntry> = {};
    for (const block of node.data?.childBlocks ?? []) {
      if (!block.position) continue;
      const resourceName = stripCompositionPrefix(block.name ?? block.id, [
        node.id,
        compName,
      ]);
      blockEntries[resourceName] = {
        x: Math.round(block.position.x),
        y: Math.round(block.position.y),
      };
    }
    out[compName] = {
      ...carried,
      ...blockEntries,
      [SELF_POSITION_KEY]: entry,
    };
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

