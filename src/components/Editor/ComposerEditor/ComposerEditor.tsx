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
import type { Block } from '../../../api/types';
import {
  parseCrossplaneConfigurationFromFiles,
  type CrossplaneFile,
  type LayoutByComposition,
} from '../../../lib/parser';
import { collectBlocks } from '../../../lib/compositionInputs';
import { mergeContainerIntoNodes } from '../../../lib/containerGraph';
import { Button } from '../../ui/button';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../ui/sidebar';
import { Breadcrumbs } from '../Breadcrumbs';
import { EditorArea } from '../EditorArea';
import { EditorAreaProvider, useEditorActions } from '../EditorAreaContext';
import { EditorAreaSidebar } from '../EditorAreaSidebar';

const DEFAULT_ENTITY_ID = 'composer';

export type ComposerSavePayload = {
  // The whole configuration as one flat list of generic blocks, layout
  // included: compositions, their Spec and Status blocks, pipeline functions
  // and resources, each placed in its parent's space. The layout file the
  // editor reads back comes from `layoutFromBlocks(blocks)`.
  blocks: Block[];
};

export type ComposerEditorProps = {
  files: CrossplaneFile[];
  layout: LayoutByComposition;
  adapter: EditorDataAdapter;
  entityRef?: EditorEntityRef;
  onSave: (payload: ComposerSavePayload) => void;
};

export type ComposerEditorHandle = {
  save: () => void;
};

type ParsedDoc = {
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

function ComposerEditorBody({ onSave, forwardedRef }: InnerProps) {
  const { getNodes, getEdges } = useReactFlow();
  const { containerSession } = useEditorActions();

  const triggerSave = useCallback(() => {
    // A save covers the whole configuration, not the level on screen: with a
    // container open, its canvas is folded back into the parked container-level
    // graph first.
    const session = containerSession.current;
    const nodes = session
      ? mergeContainerIntoNodes(
          session.nodes,
          session.containerId,
          getNodes(),
          getEdges(),
          session.connectors,
        )
      : getNodes();

    onSave({ blocks: collectBlocks(nodes as RFNode[]) });
  }, [getNodes, getEdges, containerSession, onSave]);

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
  const parsed = useMemo<ParsedDoc>(
    () => ({
      blocks: parseCrossplaneConfigurationFromFiles(props.files, props.layout)
        .blocks,
    }),
    [props.files, props.layout],
  );

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
