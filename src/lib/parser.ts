import {
  parseAllDocuments,
  parseDocument,
  stringify as yamlStringify,
} from 'yaml';
import {
  Block,
  BlockType,
  Composition,
  Edge,
  Patch,
  Pipeline,
  Resource,
} from '../api/types';
import { extractConnectors } from './editorUtils';
import { JsonObject } from './types';

const BLOCK_WIDTH = 300;
const MIN_CONTAINER_WIDTH = 500;
const MIN_RESOURCE_NODE_HEIGHT = 80;
const BLOCK_FOOTER_HEIGHT = 80;
const BLOCK_SPACING = 5;
const CONTAINER_HEADER_HEIGHT = 60;
const CONTAINER_BOTTOM_PADDING = 20;

const blockId = (parts: string[]) => parts.join('_');

const getBlocksResources = (comp: Composition): Resource[] => {
  if (Array.isArray(comp?.spec?.pipeline)) {
    const fromPipeline = comp.spec.pipeline.find(
      (p: Pipeline) =>
        typeof p === 'object' && p.step === 'patch-and-transform',
    );
    if (fromPipeline?.input?.resources) return fromPipeline.input.resources;
  }
  return Array.isArray(comp?.spec?.resources) ? comp.spec.resources : [];
};

const patchesToEdges = (
  compositionName: string,
  blockName: string,
  patches: Patch[] | undefined,
): Edge[] => {
  if (!patches?.length) return [];
  const result: Edge[] = [];
  for (const patch of patches) {
    if (patch.type === 'FromCompositeFieldPath') {
      result.push({
        source: compositionName,
        sourceHandle: patch.fromFieldPath,
        target: blockId([compositionName, blockName]),
        targetHandle: patch.toFieldPath,
        ...(patch.transforms && { transformers: patch.transforms }),
      });
    } else if (patch.type === 'ToCompositeFieldPath') {
      result.push({
        source: blockId([compositionName, blockName]),
        sourceHandle: patch.fromFieldPath,
        target: compositionName,
        targetHandle: patch.toFieldPath,
        ...(patch.transforms && { transformers: patch.transforms }),
      });
    }
  }
  return result;
};

const EMPTY_SCHEMA = {
  properties: { spec: {}, status: {}, metadata: {} },
} as unknown as BlockType['schema'];

const syntheticBlockType = (
  apiVersion: string | undefined,
  kind: string | undefined,
  leaf: boolean,
): BlockType => {
  const name = kind || 'Unknown';
  return {
    name,
    id: `${apiVersion ?? ''}/${name}`,
    schema: EMPTY_SCHEMA,
    leaf,
    kind: kind ?? '',
    apiVersion: apiVersion ?? '',
    title: name,
    description: '',
  };
};

const xrdToBlockType = (
  xrd: Record<string, unknown>,
): BlockType | undefined => {
  const spec = (xrd.spec as Record<string, unknown> | undefined) ?? undefined;
  const metadata =
    (xrd.metadata as Record<string, unknown> | undefined) ?? undefined;
  if (!spec || !metadata) return undefined;

  const versions =
    (spec.versions as Array<Record<string, unknown>> | undefined) ?? [];
  const v = versions[0];
  const schema =
    (v?.schema as { openAPIV3Schema?: Record<string, unknown> } | undefined)
      ?.openAPIV3Schema ?? {};
  const names = (spec.names as { kind?: string } | undefined) ?? {};
  const group = (spec.group as string | undefined) ?? '';
  const versionName = (v?.name as string | undefined) ?? 'v1';

  return {
    name: (metadata.name as string) ?? '',
    id: (metadata.name as string) ?? '',
    schema: schema as BlockType['schema'],
    leaf: false,
    kind: names.kind ?? '',
    apiVersion: group ? `${group}/${versionName}` : versionName,
  };
};

const estimateBlockHeight = (): number =>
  MIN_RESOURCE_NODE_HEIGHT + BLOCK_FOOTER_HEIGHT;

export const SELF_POSITION_KEY = '_self';

export type LayoutEntry = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type CompositionLayout = Record<string, LayoutEntry>;
export type LayoutByComposition = Record<string, CompositionLayout>;

type Layout = {
  position: { x: number; y: number };
  size?: { width: number; height: number };
};

const toLayout = (entry: LayoutEntry): Layout => {
  const layout: Layout = { position: { x: entry.x, y: entry.y } };
  if (
    typeof entry.width === 'number' &&
    Number.isFinite(entry.width) &&
    typeof entry.height === 'number' &&
    Number.isFinite(entry.height)
  ) {
    layout.size = { width: entry.width, height: entry.height };
  }
  return layout;
};

const isLayoutEntry = (value: unknown): value is LayoutEntry => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.x === 'number' &&
    Number.isFinite(v.x) &&
    typeof v.y === 'number' &&
    Number.isFinite(v.y)
  );
};

export const parseLayoutYaml = (text: string): LayoutByComposition => {
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = parseDocument(text).toJS();
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const compositions = (parsed as Record<string, unknown>).compositions;
  if (!compositions || typeof compositions !== 'object') return {};
  const out: LayoutByComposition = {};
  for (const [compName, value] of Object.entries(
    compositions as Record<string, unknown>,
  )) {
    if (!value || typeof value !== 'object') continue;
    const entries: CompositionLayout = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (isLayoutEntry(raw)) entries[key] = raw;
    }
    out[compName] = entries;
  }
  return out;
};

export const serializeLayoutYaml = (layout: LayoutByComposition): string => {
  const compositions: Record<string, CompositionLayout> = {};
  for (const [compName, entries] of Object.entries(layout)) {
    if (!entries) continue;
    const filtered: CompositionLayout = {};
    for (const [key, entry] of Object.entries(entries)) {
      if (isLayoutEntry(entry)) filtered[key] = entry;
    }
    if (Object.keys(filtered).length > 0) compositions[compName] = filtered;
  }
  return yamlStringify({ compositions }, { lineWidth: 0 });
};

const buildBlocksForComposition = (
  composition: Composition,
  parentBlockTypes: BlockType[],
  positions: CompositionLayout,
): Block[] => {
  const name = composition.metadata?.name;
  if (!name) return [];

  const resourceList = getBlocksResources(composition);
  const containerWidth = MIN_CONTAINER_WIDTH;
  const blockX = (containerWidth - BLOCK_WIDTH) / 2;
  let currentY = CONTAINER_HEADER_HEIGHT;

  const childBlocks: Block[] = resourceList
    .filter((r): r is Resource => !!r && typeof r === 'object')
    .map((resource, idx) => {
      const resourceName = resource.name ?? `resource-${idx}`;
      const base = (resource.base ?? {}) as Resource['base'];
      const apiVersion = base.apiVersion ?? '';
      const kind = base.kind ?? '';
      const height = estimateBlockHeight();
      const savedEntry = positions[resourceName];
      const savedLayout = savedEntry ? toLayout(savedEntry) : undefined;
      const block: Block = {
        id: blockId([name, resourceName]),
        parentId: name,
        name: blockId([name, resourceName]),
        position: savedLayout?.position ?? { x: blockX, y: currentY },
        size: savedLayout?.size ?? { width: BLOCK_WIDTH, height },
        edges: patchesToEdges(name, resourceName, resource.patches),
        blockType: syntheticBlockType(apiVersion, kind, true),
        connectors: [],
      };
      (block as Block & { apiVersion?: string; kind?: string }).apiVersion =
        apiVersion;
      (block as Block & { apiVersion?: string; kind?: string }).kind = kind;
      currentY += height + BLOCK_SPACING;
      return block;
    });

  const functions = composition.spec?.pipeline ?? [];
  const containerHeight = currentY + CONTAINER_BOTTOM_PADDING;
  const compositeRef = composition.spec?.compositeTypeRef;
  const parentBlockType =
    parentBlockTypes.find(
      (bt) =>
        bt.kind === compositeRef?.kind &&
        bt.apiVersion === compositeRef?.apiVersion,
    ) ??
    syntheticBlockType(compositeRef?.apiVersion, compositeRef?.kind, false);

  const parentEntry = positions[SELF_POSITION_KEY];
  const parentLayout = parentEntry ? toLayout(parentEntry) : undefined;
  const parentBlock: Block = {
    id: name,
    parentId: '',
    name,
    position: parentLayout?.position ?? { x: 0, y: 0 },
    size: parentLayout?.size ?? {
      width: containerWidth,
      height: containerHeight,
    },
    edges: [],
    blockType: parentBlockType,
    connectors: parentBlockType?.schema
      ? extractConnectors(parentBlockType.schema as unknown as JsonObject)
      : [],
    functions,
  };
  (parentBlock as Block & { apiVersion?: string; kind?: string }).apiVersion =
    compositeRef?.apiVersion;
  (parentBlock as Block & { apiVersion?: string; kind?: string }).kind =
    compositeRef?.kind;

  return [...childBlocks, parentBlock];
};

export type ParsedCrossplane = {
  blocks: Block[];
  blockTypes: BlockType[];
  compositions: Composition[];
  errors: string[];
};

export type PackageDependency = {
  kind: 'provider' | 'function';
  package: string;
  version: string;
};

export const parseCrossplaneDependencies = (
  yamlText: string,
): PackageDependency[] => {
  let docs: Record<string, unknown>[] = [];
  try {
    docs = parseAllDocuments(yamlText)
      .map((d) => {
        try {
          return d.toJS();
        } catch {
          return null;
        }
      })
      .filter(
        (d): d is Record<string, unknown> => !!d && typeof d === 'object',
      );
  } catch {
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const doc of docs) {
    if (doc?.kind !== 'Configuration') continue;
    const spec = doc.spec as Record<string, unknown> | undefined;
    const list = spec?.dependsOn;
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const version = typeof e.version === 'string' ? e.version : '';
      if (typeof e.provider === 'string') {
        deps.push({ kind: 'provider', package: e.provider, version });
      } else if (typeof e.function === 'string') {
        deps.push({ kind: 'function', package: e.function, version });
      }
    }
  }
  return deps;
};

export const parseCrossplaneConfiguration = (
  yamlText: string,
  layout: LayoutByComposition = {},
): ParsedCrossplane => {
  const parsed = parseCrossplaneConfigurationFromFiles(
    [{ name: 'crossplane.yaml', content: yamlText }],
    layout,
  );
  return {
    blocks: parsed.blocks,
    blockTypes: parsed.blockTypes,
    compositions: parsed.compositions,
    errors: parsed.errors,
  };
};

export type CrossplaneFile = {
  name: string;
  content: string;
};

export type OriginIndex = {
  compositions: Record<string, string>;
  xrds: Record<string, string>;
  configurationFile: string | null;
};

export type ParsedCrossplaneWithProvenance = ParsedCrossplane & {
  origin: OriginIndex;
};

export const parseCrossplaneConfigurationFromFiles = (
  files: CrossplaneFile[],
  layout: LayoutByComposition = {},
): ParsedCrossplaneWithProvenance => {
  type Tagged = { doc: Record<string, unknown>; file: string };
  const tagged: Tagged[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const docs = parseAllDocuments(file.content);
      for (const d of docs) {
        try {
          const js = d.toJS();
          if (js && typeof js === 'object') {
            tagged.push({
              doc: js as Record<string, unknown>,
              file: file.name,
            });
          }
        } catch (err) {
          errors.push(
            `${file.name}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const origin: OriginIndex = {
    compositions: {},
    xrds: {},
    configurationFile: null,
  };

  const xrds: Record<string, unknown>[] = [];
  const compositions: Composition[] = [];

  for (const { doc, file } of tagged) {
    const kind = doc?.kind;
    const name = (doc?.metadata as Record<string, unknown> | undefined)?.name;
    if (kind === 'CompositeResourceDefinition') {
      xrds.push(doc);
      if (typeof name === 'string') origin.xrds[name] = file;
    } else if (kind === 'Composition') {
      compositions.push(doc as unknown as Composition);
      if (typeof name === 'string') origin.compositions[name] = file;
    } else if (kind === 'Configuration' && !origin.configurationFile) {
      origin.configurationFile = file;
    }
  }

  const blockTypes = xrds
    .map(xrdToBlockType)
    .filter((bt): bt is BlockType => !!bt);

  const blocks: Block[] = [];
  for (const comp of compositions) {
    if (!comp || typeof comp !== 'object') {
      errors.push('non-object composition');
      continue;
    }
    if (!comp.metadata?.name) {
      errors.push('composition missing metadata.name');
      continue;
    }
    try {
      const compPositions = layout[comp.metadata.name] ?? {};
      const built = buildBlocksForComposition(comp, blockTypes, compPositions);
      blocks.push(...built);
    } catch (err) {
      const msg =
        err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      console.error('[overlock] build error for', comp.metadata.name, msg);
      errors.push(
        `${comp.metadata.name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return { blocks, blockTypes, compositions, errors, origin };
};
