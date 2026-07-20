'use client';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  type Ref,
} from 'react';
import {
  ReactFlowProvider,
  useReactFlow,
  type Edge as RFEdge,
  type Node as RFNode,
} from '@xyflow/react';
import { PanelRight, Save } from 'lucide-react';
import type { EditorDataAdapter, EditorEntityRef } from '../../../api/adapter';
import type { BlockType, Connector, Transformer } from '../../../api/types';
import {
  parseCrossplaneConfigurationFromFiles,
  parseCrossplaneDependencies,
  SELF_POSITION_KEY,
  type CrossplaneFile,
  type LayoutByComposition,
  type LayoutEntry,
  type OriginIndex,
  type PackageDependency,
} from '../../../lib/parser';
import {
  serializeCrossplaneFiles,
  type ResourceEdgeInput,
  type SerializerCompositionInput,
} from '../../../lib/serializer';
import { Button } from '../../ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../../ui/sidebar';
import { EditorArea } from '../EditorArea';
import { EditorAreaProvider, useEditorActions } from '../EditorAreaContext';
import { EditorAreaSidebar } from '../EditorAreaSidebar';

const DEFAULT_ENTITY_ID = 'composer';

export type ComposerSavePayload = {
  files: { name: string; content: string }[];
  hashes: Record<string, string>;
  layout: LayoutByComposition;
};

export type ComposerEditorProps = {
  files: CrossplaneFile[];
  crossplaneFile: string;
  hashes: Record<string, string>;
  layout: LayoutByComposition;
  adapter: EditorDataAdapter;
  entityRef?: EditorEntityRef;
  onSave: (payload: ComposerSavePayload) => void;
};

export type ComposerEditorHandle = {
  save: () => void;
};

type ParsedDoc = {
  files: CrossplaneFile[];
  origin: OriginIndex;
  deps: PackageDependency[];
  blocks: ReturnType<typeof parseCrossplaneConfigurationFromFiles>['blocks'];
};

const collectPositions = (
  nodes: {
    type?: string;
    position?: { x: number; y: number } | null;
    measured?: { width?: number; height?: number };
    parentId?: string;
    data?: { name?: unknown };
    id: string;
  }[],
): LayoutByComposition => {
  const out: LayoutByComposition = {};
  for (const node of nodes) {
    if (node.type === 'connector') continue;
    if (!node.position) continue;
    const x = Math.round(node.position.x);
    const y = Math.round(node.position.y);
    const w = node.measured?.width;
    const h = node.measured?.height;
    const entry: LayoutEntry =
      !node.parentId && w !== undefined && h !== undefined
        ? { x, y, width: Math.round(w), height: Math.round(h) }
        : { x, y };

    if (!node.parentId) {
      const compName = (node.data?.name as string | undefined) ?? node.id;
      out[compName] ??= {};
      out[compName][SELF_POSITION_KEY] = entry;
      continue;
    }
    const compName = node.parentId;
    const fullName = (node.data?.name as string | undefined) ?? node.id;
    const resourceName = fullName.startsWith(`${compName}_`)
      ? fullName.slice(compName.length + 1)
      : fullName;
    out[compName] ??= {};
    out[compName][resourceName] = entry;
  }
  return out;
};

const buildCompositionInputs = (
  nodes: RFNode[],
  edges: RFEdge[],
): Record<string, SerializerCompositionInput> => {
  const out: Record<string, SerializerCompositionInput> = {};
  const containers = nodes.filter((n) => !n.parentId);
  for (const c of containers) {
    const data = (c.data ?? {}) as {
      name?: string;
      kind?: string;
      apiVersion?: string;
      blockType?: BlockType;
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

    const connectorPrefix = `${c.id}-`;
    const isOwnConnectorId = (id: unknown): id is string =>
      typeof id === 'string' && id.startsWith(connectorPrefix);
    const fieldPathFromConnectorId = (id: string): string =>
      id.slice(connectorPrefix.length);

    const ownConnectors: Connector[] = [];
    for (const n of nodes) {
      if (n.parentId !== c.id || n.type !== 'connector') continue;
      const conn = (n.data as { connector?: Connector }).connector;
      if (conn) ownConnectors.push(conn);
    }

    const children = nodes
      .filter((n) => n.parentId === c.id && n.type !== 'connector')
      .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));

    const resources = children.map((child) => {
      const cData = (child.data ?? {}) as {
        name?: string;
        blockType?: BlockType;
      };
      const fullName = cData.name ?? child.id;
      const resourceName = fullName.startsWith(`${compName}_`)
        ? fullName.slice(compName.length + 1)
        : fullName;
      const apiVersion = cData.blockType?.apiVersion ?? '';
      const kind = cData.blockType?.kind ?? '';

      const childEdges: ResourceEdgeInput[] = [];
      for (const e of edges) {
        const transformers = (
          (e.data ?? {}) as { transformers?: Transformer[] }
        ).transformers;
        if (isOwnConnectorId(e.source) && e.target === child.id) {
          childEdges.push({
            direction: 'fromComposite',
            fromFieldPath: fieldPathFromConnectorId(e.source),
            toFieldPath: e.targetHandle ?? '',
            transformers,
          });
        } else if (e.source === child.id && isOwnConnectorId(e.target)) {
          childEdges.push({
            direction: 'toComposite',
            fromFieldPath: e.sourceHandle ?? '',
            toFieldPath: fieldPathFromConnectorId(e.target),
            transformers,
          });
        }
      }

      return { name: resourceName, apiVersion, kind, edges: childEdges };
    });

    out[compName] = {
      resources,
      metadata: { name: compName },
      compositeTypeRef,
      connectors: ownConnectors,
      originalName: c.id !== compName ? c.id : undefined,
    };
  }
  return out;
};

function DocSync({ parsed }: { parsed: ParsedDoc }) {
  const { setBlocks, setNodes, setEdges } = useEditorActions();
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setBlocks(parsed.blocks);
  }, [parsed, setBlocks, setNodes, setEdges]);
  return null;
}

type InnerProps = ComposerEditorProps & {
  parsed: ParsedDoc;
  forwardedRef: Ref<ComposerEditorHandle>;
};

function ComposerEditorBody({
  parsed,
  files,
  crossplaneFile,
  hashes,
  onSave,
  forwardedRef,
}: InnerProps) {
  const { getNodes, getEdges } = useReactFlow();

  const triggerSave = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    const layout = collectPositions(nodes);
    const compositions = buildCompositionInputs(
      nodes as RFNode[],
      edges as RFEdge[],
    );
    const providers = parsed.deps.filter((d) => d.kind === 'provider');
    const functions = parsed.deps.filter((d) => d.kind === 'function');
    const filesByName = serializeCrossplaneFiles({
      files,
      origin: parsed.origin,
      crossplaneFile,
      compositions,
      providers,
      functions,
    });

    const changedFiles = Object.entries(filesByName)
      .filter(([name, content]) => {
        const original = files.find((f) => f.name === name);
        return !original || original.content !== content;
      })
      .map(([name, content]) => ({ name, content }));

    onSave({ files: changedFiles, hashes, layout });
  }, [getNodes, getEdges, parsed, files, crossplaneFile, hashes, onSave]);

  useImperativeHandle(forwardedRef, () => ({ save: triggerSave }), [
    triggerSave,
  ]);

  return (
    <SidebarProvider defaultLeftOpen={false} defaultRightOpen={false}>
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-10 shrink-0 items-center justify-end gap-2 border-b border-border/60 px-2 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            onClick={triggerSave}
            aria-label="Save"
          >
            <Save className="h-4 w-4" />
          </Button>
          <SidebarTrigger side="right" aria-label="Toggle blocks panel">
            <PanelRight className="h-4 w-4" />
          </SidebarTrigger>
        </header>
        <div style={{ flex: 1, minHeight: 0 }}>
          <EditorArea />
        </div>
      </SidebarInset>
      <EditorAreaSidebar />
    </SidebarProvider>
  );
}

export const ComposerEditor = forwardRef<
  ComposerEditorHandle,
  ComposerEditorProps
>(function ComposerEditor(props, ref) {
  const parsed = useMemo<ParsedDoc>(() => {
    const result = parseCrossplaneConfigurationFromFiles(
      props.files,
      props.layout,
    );
    const main =
      props.files.find((f) => f.name === props.crossplaneFile)?.content ?? '';
    return {
      files: props.files,
      origin: result.origin,
      deps: parseCrossplaneDependencies(main),
      blocks: result.blocks,
    };
  }, [props.files, props.layout, props.crossplaneFile]);

  const entityRef = props.entityRef ?? {
    entity: 'configuration' as const,
    entityId: DEFAULT_ENTITY_ID,
  };

  return (
    <ReactFlowProvider>
      <EditorAreaProvider adapter={props.adapter} entityRef={entityRef}>
        <DocSync parsed={parsed} />
        <ComposerEditorBody {...props} parsed={parsed} forwardedRef={ref} />
      </EditorAreaProvider>
    </ReactFlowProvider>
  );
});
