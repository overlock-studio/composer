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
  type Node as RFNode,
} from '@xyflow/react';
import { PanelRight, Save } from 'lucide-react';
import type { EditorDataAdapter, EditorEntityRef } from '../../../api/adapter';
import {
  parseCrossplaneConfigurationFromFiles,
  parseCrossplaneDependencies,
  type CrossplaneFile,
  type LayoutByComposition,
  type OriginIndex,
  type PackageDependency,
} from '../../../lib/parser';
import { serializeCrossplaneFiles } from '../../../lib/serializer';
import {
  buildCompositionInputs,
  collectPositions,
} from '../../../lib/compositionInputs';
import { Button } from '../../ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../../ui/sidebar';
import { Breadcrumbs } from '../Breadcrumbs';
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
  layout: savedLayout,
  onSave,
  forwardedRef,
}: InnerProps) {
  const { getNodes } = useReactFlow();

  const triggerSave = useCallback(() => {
    const nodes = getNodes();
    const layout = collectPositions(nodes, savedLayout);
    const compositions = buildCompositionInputs(nodes as RFNode[]);
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
  }, [getNodes, parsed, files, crossplaneFile, hashes, onSave, savedLayout]);

  useImperativeHandle(forwardedRef, () => ({ save: triggerSave }), [
    triggerSave,
  ]);

  return (
    <SidebarProvider defaultLeftOpen={false} defaultRightOpen={false}>
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-2 backdrop-blur">
          <Breadcrumbs />
          <div className="flex-1" />
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
